import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Wallet,
  WalletDocument,
  WalletTransaction,
  WalletTransactionType,
} from '../schemas/wallet.schema';
import { FlutterwaveService } from '../services/flutterwave.service';
import { Transaction, TransactionDocument, TransactionType } from '../schemas/transaction.schema';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  
  // Minimum withdrawal amount in XAF
  private readonly MIN_WITHDRAWAL = 5000;
  
  // Commission rates
  private readonly COMMISSION_RATES = {
    PROPERTY_SALE: 0.05,      // 5% commission on sales
    PROPERTY_RENTAL: 0.10,    // 10% commission on rentals (one month)
    REFERRAL: 0.02,           // 2% referral commission
  };

  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    private flutterwaveService: FlutterwaveService,
  ) {}

  /**
   * Get or create wallet for user
   */
  async getOrCreateWallet(userId: string): Promise<WalletDocument> {
    let wallet = await this.walletModel.findOne({ userId: new Types.ObjectId(userId) });

    if (!wallet) {
      wallet = new this.walletModel({
        userId: new Types.ObjectId(userId),
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        transactions: [],
      });
      await wallet.save();
      this.logger.log(`Wallet created for user: ${userId}`);
    }

    return wallet;
  }

  /**
   * Get wallet by user ID
   */
  async getWallet(userId: string): Promise<WalletDocument> {
    const wallet = await this.walletModel.findOne({ userId: new Types.ObjectId(userId) });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  /**
   * Credit wallet (add funds)
   */
  async creditWallet(
    userId: string,
    amount: number,
    description: string,
    reference?: string,
    transactionId?: Types.ObjectId,
  ): Promise<WalletDocument> {
    const wallet = await this.getOrCreateWallet(userId);

    const transaction: WalletTransaction = {
      type: WalletTransactionType.CREDIT,
      amount,
      balance: wallet.balance + amount,
      description,
      reference,
      transactionId,
      createdAt: new Date(),
    };

    wallet.balance += amount;
    wallet.availableBalance = (wallet.availableBalance ?? 0) + amount;
    wallet.totalEarned += amount;
    wallet.transactions.unshift(transaction);
    wallet.lastTransactionDate = new Date();

    await wallet.save();

    this.logger.log(`Wallet credited: ${userId} - ${amount} XAF`);
    return wallet;
  }

  /**
   * Debit wallet (remove funds)
   */
  async debitWallet(
    userId: string,
    amount: number,
    description: string,
    reference?: string,
  ): Promise<WalletDocument> {
    const wallet = await this.getWallet(userId);

    if (wallet.balance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const transaction: WalletTransaction = {
      type: WalletTransactionType.DEBIT,
      amount,
      balance: wallet.balance - amount,
      description,
      reference,
      createdAt: new Date(),
    };

    wallet.balance -= amount;
    wallet.availableBalance = Math.max(0, (wallet.availableBalance ?? 0) - amount);
    wallet.transactions.unshift(transaction);
    wallet.lastTransactionDate = new Date();

    await wallet.save();

    this.logger.log(`Wallet debited: ${userId} - ${amount} XAF`);
    return wallet;
  }

  /**
   * Add commission to wallet
   */
  async addCommission(
    agentId: string,
    amount: number,
    propertyId: string,
    commissionType: 'sale' | 'rental' | 'referral',
  ): Promise<WalletDocument> {
    const commissionAmount = this.calculateCommission(amount, commissionType);

    return this.creditWallet(
      agentId,
      commissionAmount,
      `Commission from ${commissionType} - Property ${propertyId}`,
      `COMM-${Date.now()}`,
    );
  }

  /**
   * Calculate commission amount
   */
  private calculateCommission(amount: number, type: 'sale' | 'rental' | 'referral'): number {
    let rate = 0;

    switch (type) {
      case 'sale':
        rate = this.COMMISSION_RATES.PROPERTY_SALE;
        break;
      case 'rental':
        rate = this.COMMISSION_RATES.PROPERTY_RENTAL;
        break;
      case 'referral':
        rate = this.COMMISSION_RATES.REFERRAL;
        break;
    }

    return Math.floor(amount * rate);
  }

  /**
   * Request withdrawal
   */
  async requestWithdrawal(
    userId: string,
    amount: number,
    withdrawalMethod: 'mtn_momo' | 'orange_money' | 'bank_transfer',
    accountDetails: {
      phoneNumber?: string;
      accountNumber?: string;
      accountName?: string;
      bankCode?: string;
    },
  ): Promise<any> {
    const wallet = await this.getWallet(userId);

    // Validations
    if (amount < this.MIN_WITHDRAWAL) {
      throw new BadRequestException(
        `Minimum withdrawal amount is ${this.MIN_WITHDRAWAL} XAF`,
      );
    }

    const available = wallet.availableBalance || wallet.balance;
    if (available < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Debit wallet immediately — user's balance is reserved
    await this.debitWallet(
      userId,
      amount,
      `Withdrawal via ${withdrawalMethod}`,
      `WD-${Date.now()}`,
    );

    // Persist the withdrawal as 'pending' right away so the user gets a success response
    const reference = `WD-${Date.now()}`;
    const transaction = new this.transactionModel({
      userId: new Types.ObjectId(userId),
      amount,
      currency: 'XAF',
      type: TransactionType.WALLET_WITHDRAWAL,
      status: 'pending',
      paymentMethod: withdrawalMethod,
      description: `Withdrawal to ${withdrawalMethod}`,
      flutterwaveReference: reference,
    });
    await transaction.save();

    // Update totalWithdrawn counter
    wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) + amount;
    await wallet.save();

    // Dispatch Flutterwave payout in the background — never block or throw to the user.
    // If Flutterwave rejects, the tx stays 'pending' for manual / cron retry.
    this.dispatchFlutterwavePayout(
      amount,
      withdrawalMethod,
      accountDetails,
      reference,
      transaction._id as Types.ObjectId,
    ).catch(err =>
      this.logger.error(`Background Flutterwave payout error (tx ${transaction._id}): ${err.message}`),
    );

    this.logger.log(`Withdrawal queued: ${userId} - ${amount} XAF via ${withdrawalMethod}`);

    return {
      message: 'Withdrawal request submitted successfully',
      amount,
      withdrawalMethod,
      estimatedTime: '24-48 hours',
      transaction,
    };
  }

  /**
   * Attempt to push the actual payout to Flutterwave.
   * Runs in the background — failures are logged but never surface to the user.
   */
  private async dispatchFlutterwavePayout(
    amount: number,
    withdrawalMethod: string,
    accountDetails: { phoneNumber?: string; accountNumber?: string; accountName?: string; bankCode?: string },
    reference: string,
    transactionId: Types.ObjectId,
  ): Promise<void> {
    try {
      let payload: any;

      if (withdrawalMethod === 'bank_transfer') {
        payload = {
          account_bank: accountDetails.bankCode,
          account_number: accountDetails.accountNumber,
          amount,
          currency: 'XAF',
          narration: 'HoroHouse withdrawal',
          reference,
          beneficiary_name: accountDetails.accountName,
        };
      } else {
        const network = withdrawalMethod === 'mtn_momo' ? 'MTN' : 'ORANGE';
        payload = {
          account_bank: network,
          account_number: accountDetails.phoneNumber!,
          amount,
          currency: 'XAF',
          narration: 'HoroHouse withdrawal',
          reference,
        };
      }

      const flwResponse = await this.flutterwaveService.initiateBankTransfer(payload);
      this.logger.log(`Flutterwave payout accepted: ${JSON.stringify(flwResponse)}`);

      // Mark as successful once Flutterwave confirms
      await this.transactionModel.findByIdAndUpdate(transactionId, {
        status: 'success',
        paymentProviderResponse: flwResponse,
        completedAt: new Date(),
      });
    } catch (error) {
      this.logger.error(`Flutterwave payout failed (tx ${transactionId}): ${error.message}`);
      // Store the error on the transaction for later inspection / retry
      await this.transactionModel.findByIdAndUpdate(transactionId, {
        paymentProviderResponse: { error: error.message },
      });
      throw error;
    }
  }

  /**
   * Update bank account details
   */
  async updateBankAccount(
    userId: string,
    bankDetails: {
      accountName: string;
      accountNumber: string;
      bankName: string;
      bankCode: string;
    },
  ): Promise<WalletDocument> {
    const wallet = await this.getWallet(userId);

    wallet.bankAccountName = bankDetails.accountName;
    wallet.bankAccountNumber = bankDetails.accountNumber;
    wallet.bankName = bankDetails.bankName;
    wallet.bankCode = bankDetails.bankCode;

    await wallet.save();

    this.logger.log(`Bank account updated for user: ${userId}`);
    return wallet;
  }

  /**
   * Update Mobile Money details
   */
  async updateMobileMoneyAccount(
    userId: string,
    mobileMoneyDetails: {
      phoneNumber: string;
      provider: 'MTN' | 'ORANGE';
    },
  ): Promise<WalletDocument> {
    const wallet = await this.getWallet(userId);

    wallet.mobileMoneyNumber = mobileMoneyDetails.phoneNumber;
    wallet.mobileMoneyProvider = mobileMoneyDetails.provider;

    await wallet.save();

    this.logger.log(`Mobile Money account updated for user: ${userId}`);
    return wallet;
  }

  /**
   * Enable auto-withdrawal
   */
  async enableAutoWithdrawal(
    userId: string,
    threshold: number,
  ): Promise<WalletDocument> {
    const wallet = await this.getWallet(userId);

    if (threshold < this.MIN_WITHDRAWAL) {
      throw new BadRequestException(
        `Threshold must be at least ${this.MIN_WITHDRAWAL} XAF`,
      );
    }

    wallet.autoWithdrawal = true;
    wallet.autoWithdrawalThreshold = threshold;

    await wallet.save();

    this.logger.log(`Auto-withdrawal enabled for user: ${userId}`);
    return wallet;
  }

  /**
   * Get wallet transactions
   */
  async getTransactions(
    userId: string,
    limit: number = 50,
  ): Promise<WalletTransaction[]> {
    const wallet = await this.getWallet(userId);
    return wallet.transactions.slice(0, limit);
  }

  /**
   * Get wallet statistics
   */
  async getWalletStats(userId: string): Promise<any> {
    const wallet = await this.getWallet(userId);

    // Calculate this month's earnings
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const thisMonthTransactions = wallet.transactions.filter(
      t => t.type === WalletTransactionType.CREDIT && 
           t.createdAt >= startOfMonth,
    );

    const thisMonthEarnings = thisMonthTransactions.reduce(
      (sum, t) => sum + t.amount,
      0,
    );

    return {
      balance: wallet.balance,
      availableBalance: wallet.availableBalance || wallet.balance,
      pendingBalance: wallet.pendingBalance,
      totalEarned: wallet.totalEarned,
      totalWithdrawn: wallet.totalWithdrawn || 0,
      thisMonthEarnings,
      transactionCount: wallet.transactions.length,
      lastTransactionDate: wallet.lastTransactionDate,
      autoWithdrawal: wallet.autoWithdrawal,
      autoWithdrawalThreshold: wallet.autoWithdrawalThreshold,
      // payout account details for the withdraw modal
      bankAccountName: wallet.bankAccountName,
      bankAccountNumber: wallet.bankAccountNumber,
      bankName: wallet.bankName,
      bankCode: wallet.bankCode,
      mobileMoneyNumber: wallet.mobileMoneyNumber,
      mobileMoneyProvider: wallet.mobileMoneyProvider,
      currency: 'XAF',
    };
  }
}