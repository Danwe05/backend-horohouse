import {
  Injectable, Logger, NotFoundException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { FlutterwaveService } from './flutterwave.service';
import { WalletService } from './wallet.service';

import {
  Transaction, TransactionDocument,
  TransactionType, TransactionStatus, PaymentMethod, Currency,
} from '../schemas/transaction.schema';
import {
  Booking, BookingDocument,
  BookingStatus, PaymentStatus,
} from '../../bookings/schema/booking.schema';
import { InitializePaymentDto, VerifyPaymentDto, TransactionQueryDto } from '../dto/payment.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { User, UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  /** Platform fee taken from each booking payout (10%) */
  private readonly BOOKING_PLATFORM_FEE_RATE = 0.10;

  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
    private flutterwaveService: FlutterwaveService,
    private configService: ConfigService,
    private walletService: WalletService,
  ) { }

  // ════════════════════════════════════════════════════════════════════════
  // EXISTING — initializePayment (unchanged)
  // ════════════════════════════════════════════════════════════════════════

  // ════════════════════════════════════════════════════════════════════════
  // PRIVATE: Build a valid email for Flutterwave
  // Flutterwave requires a non-empty customer_email.
  // If the user has no email, generate a placeholder from their phone number.
  // ════════════════════════════════════════════════════════════════════════
  private resolveCustomerEmail(user: User, override?: string | null): string {
    if (override) return override;
    if (user.email) return user.email;
    const phone = (user as any).phoneNumber;
    if (phone) {
      // Strip non-alphanumeric chars and use as a placeholder
      const sanitised = phone.replace(/[^a-zA-Z0-9]/g, '');
      return `${sanitised}@noreply.horohouse.com`;
    }
    throw new BadRequestException(
      'Your account has no email address. Please add an email to your profile before making a payment.',
    );
  }

  async initializePayment(
    dto: InitializePaymentDto,
    user: User,
  ): Promise<{ transaction: TransactionDocument; paymentLink: string }> {
    try {
      this.logger.log(`Initializing payment for user ${user._id}: ${JSON.stringify(dto)}`);

      const txRef = this.generateTransactionReference(dto.type);
      const { platformFee, paymentProcessingFee, netAmount } = this.calculateFees(
        dto.amount,
        dto.paymentMethod,
      );

      const transaction = new this.transactionModel({
        userId: user._id,
        amount: dto.amount,
        currency: dto.currency || Currency.XAF,
        type: dto.type,
        status: TransactionStatus.PENDING,
        paymentMethod: dto.paymentMethod,
        flutterwaveReference: txRef,
        propertyId: dto.propertyId ? new Types.ObjectId(dto.propertyId) : undefined,
        description: dto.description || this.getTransactionDescription(dto),
        metadata: dto.metadata,
        platformFee,
        paymentProcessingFee,
        netAmount,
        customerName: dto.customerName || user.name,
        customerEmail: dto.customerEmail || user.email,
        customerPhone: dto.customerPhone || user.phoneNumber,
      });

      await transaction.save();

      const redirectUrl = dto.redirectUrl ||
        `${this.configService.get('FRONTEND_URL')}/payment/callback`;

      const flutterwavePayload = {
        tx_ref: txRef,
        amount: dto.amount,
        currency: dto.currency || Currency.XAF,
        redirect_url: redirectUrl,
        customer: {
          email: this.resolveCustomerEmail(user, dto.customerEmail),
          phonenumber: dto.customerPhone || (user as any).phoneNumber || '',
          name: dto.customerName || user.name,
        },
        customizations: {
          title: 'HoroHouse Payment',
          description: transaction.description || 'Payment for HoroHouse services',
          logo: this.configService.get('APP_LOGO_URL'),
        },
        payment_options: this.getPaymentOptions(dto.paymentMethod),
        meta: {
          transactionId: transaction._id.toString(),
          userId: user._id.toString(),
          type: dto.type,
          paymentMethod: dto.paymentMethod,
          ...dto.metadata,
        },
      };

      const flutterwaveResponse = await this.flutterwaveService.initializePayment(
        flutterwavePayload,
      );

      const paymentLink = flutterwaveResponse.data.link;
      transaction.flutterwavePaymentLink = paymentLink;
      transaction.flutterwaveTransactionId = flutterwaveResponse.data?.id?.toString();
      transaction.paymentProviderResponse = flutterwaveResponse;
      await transaction.save();

      this.logger.log(`Payment initialized: ${transaction._id}, Link: ${paymentLink}`);
      return { transaction, paymentLink };
    } catch (error) {
      this.logger.error('Initialize payment error:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // NEW — initiateBookingPayment
  // Call this right after createBooking(). Only the booking guest can call it.
  // Idempotent: returns the existing pending transaction if one exists.
  // ════════════════════════════════════════════════════════════════════════

  async initiateBookingPayment(
    bookingId: string,
    user: User,
  ): Promise<{ transaction: TransactionDocument; paymentLink: string; txRef: string }> {
    this.logger.log(`Initiating booking payment | booking: ${bookingId} | user: ${user._id}`);

    // ── Load & guard ────────────────────────────────────────────────────────
    const booking = await this.bookingModel
      .findById(bookingId)
      .populate('propertyId', 'title isInstantBookable')
      .exec();

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.guestId.toString() !== (user._id as any).toString()) {
      throw new ForbiddenException('Only the booking guest can initiate payment');
    }
    if (booking.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('This booking has already been paid');
    }
    if ([BookingStatus.CANCELLED, BookingStatus.REJECTED].includes(booking.status)) {
      throw new BadRequestException('Cannot pay for a cancelled or rejected booking');
    }

    // ── Idempotency: reuse if a pending transaction already exists ──────────
    const existing = await this.transactionModel.findOne({
      bookingId: new Types.ObjectId(bookingId),
      status: TransactionStatus.PENDING,
    });
    if (existing?.flutterwavePaymentLink) {
      this.logger.log(`Reusing pending transaction: ${existing._id}`);
      return {
        transaction: existing,
        paymentLink: existing.flutterwavePaymentLink,
        txRef: existing.flutterwaveReference!,
      };
    }

    // ── Build transaction ───────────────────────────────────────────────────
    const txRef = this.generateTransactionReference(TransactionType.BOOKING);
    const amount = booking.priceBreakdown.totalAmount;
    const currency = (booking.currency as Currency) ?? Currency.XAF;
    const propertyTitle = (booking.propertyId as any)?.title ?? 'Property Booking';

    const { platformFee, paymentProcessingFee, netAmount } = this.calculateFees(
      amount,
      PaymentMethod.CARD, // default — user picks method inside the Flutterwave modal
    );

    const transaction = new this.transactionModel({
      userId: user._id,
      bookingId: new Types.ObjectId(bookingId),
      amount,
      currency,
      type: TransactionType.BOOKING,
      status: TransactionStatus.PENDING,
      paymentMethod: PaymentMethod.CARD,
      flutterwaveReference: txRef,
      description: `Booking payment: ${propertyTitle} · ${booking.nights} night${booking.nights !== 1 ? 's' : ''}`,
      platformFee,
      paymentProcessingFee,
      netAmount,
      customerName: user.name,
      customerEmail: user.email,
      customerPhone: (user as any).phoneNumber,
      metadata: {
        bookingId,
        propertyTitle,
        checkIn: booking.checkIn.toISOString(),
        checkOut: booking.checkOut.toISOString(),
        nights: booking.nights,
      },
    });

    await transaction.save();

    // ── Call Flutterwave — same initializePayment flow you already have ─────
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    const flwPayload = {
      tx_ref: txRef,
      amount,
      currency,
      redirect_url: `${frontendUrl}/dashboard/bookings/${bookingId}/payment-callback`,
      customer: {
        email: this.resolveCustomerEmail(user),
        phonenumber: (user as any).phoneNumber ?? '',
        name: user.name ?? '',
      },
      customizations: {
        title: 'HoroHouse Stay Payment',
        description: `${propertyTitle} · ${booking.nights} night${booking.nights !== 1 ? 's' : ''}`,
        logo: this.configService.get('APP_LOGO_URL'),
      },
      // All options — user chooses inside the modal (card, momo, bank)
      payment_options: 'card,mobilemoney,account,banktransfer',
      meta: {
        transactionId: transaction._id.toString(),
        bookingId,
        userId: (user._id as any).toString(),
        type: TransactionType.BOOKING,
      },
    };

    const flwResponse = await this.flutterwaveService.initializePayment(flwPayload);
    const paymentLink = flwResponse.data.link;

    // Persist link on transaction
    transaction.flutterwavePaymentLink = paymentLink;
    transaction.flutterwaveTransactionId = flwResponse.data?.id?.toString();
    transaction.paymentProviderResponse = flwResponse;
    await transaction.save();

    // Store txRef on booking so webhook can find it by reference
    await this.bookingModel.findByIdAndUpdate(bookingId, {
      paymentReference: txRef,
    });

    this.logger.log(
      `Booking payment initiated | tx: ${transaction._id} | txRef: ${txRef} | ${amount} ${currency}`,
    );

    return { transaction, paymentLink, txRef };
  }

  // ════════════════════════════════════════════════════════════════════════
  // EXISTING — verifyPayment (unchanged)
  // ════════════════════════════════════════════════════════════════════════

  async verifyPayment(dto: VerifyPaymentDto, user: User): Promise<Transaction> {
    try {
      this.logger.log(`Verifying payment: ${dto.transactionId}`);

      const transaction = await this.transactionModel.findOne({
        _id: dto.transactionId,
        userId: user._id,
      });

      if (!transaction) throw new NotFoundException('Transaction not found');
      if (transaction.status === TransactionStatus.SUCCESS) return transaction;

      const flutterwaveTransactionId =
        transaction.flutterwaveTransactionId || dto.flutterwaveReference;

      if (!flutterwaveTransactionId) {
        throw new BadRequestException('No Flutterwave transaction ID found');
      }

      const verificationResponse = await this.flutterwaveService.verifyPayment(
        flutterwaveTransactionId,
      );

      if (
        verificationResponse.data.status === 'successful' &&
        verificationResponse.data.amount >= transaction.amount
      ) {
        transaction.status = TransactionStatus.SUCCESS;
        transaction.completedAt = new Date();
        transaction.flutterwaveTransactionId = verificationResponse.data.id.toString();
        transaction.paymentProviderResponse = verificationResponse;
        await transaction.save();
        await this.processSuccessfulPayment(transaction);
        this.logger.log(`Payment verified successfully: ${transaction._id}`);
      } else if (verificationResponse.data.status === 'failed') {
        transaction.status = TransactionStatus.FAILED;
        transaction.failureReason =
          verificationResponse.data.processor_response || 'Payment failed';
        await transaction.save();
      }

      return transaction;
    } catch (error) {
      this.logger.error('Verify payment error:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // EXISTING — handleWebhook (unchanged except processSuccessfulPayment now works)
  // ════════════════════════════════════════════════════════════════════════

  async handleWebhook(payload: any, signature: string): Promise<void> {
    try {
      const isValid = this.flutterwaveService.verifyWebhookSignature(signature, payload);
      if (!isValid) {
        this.logger.error('Invalid webhook signature');
        throw new BadRequestException('Invalid webhook signature');
      }

      const { event, data } = payload;
      this.logger.log(`Webhook received: ${event}, ref: ${data.reference ?? data.tx_ref}`);

      // Transfer webhooks use data.reference; charge webhooks use data.tx_ref
      const flwRef = data.reference ?? data.tx_ref;
      const transaction = await this.transactionModel.findOne({
        flutterwaveReference: flwRef,
      });

      if (!transaction) {
        this.logger.warn(`No transaction found for reference: ${flwRef} (event: ${event})`);
        return;
      }

      switch (event) {
        // ── Incoming payments (bookings, subscriptions, etc.) ─────────────────
        case 'charge.completed':
          if (data.status === 'successful' && data.amount >= transaction.amount) {
            if (transaction.status === TransactionStatus.SUCCESS) {
              this.logger.log(`Duplicate webhook for already-successful tx: ${transaction._id}`);
              return;
            }
            transaction.status = TransactionStatus.SUCCESS;
            transaction.completedAt = new Date();
            transaction.flutterwaveTransactionId = data.id.toString();
            transaction.paymentProviderResponse = data;
            transaction.paymentMethod = this.mapFlwPaymentType(data.payment_type);
            await transaction.save();
            await this.processSuccessfulPayment(transaction);
            this.logger.log(`Webhook: charge successful — tx: ${transaction._id}`);
          }
          break;

        case 'charge.failed':
          transaction.status = TransactionStatus.FAILED;
          transaction.failureReason = data.processor_response || 'Payment failed';
          transaction.paymentProviderResponse = data;
          await transaction.save();
          this.logger.log(`Webhook: charge failed — tx: ${transaction._id}`);
          break;

        // ── Outgoing payouts (wallet withdrawals) ─────────────────────────────
        case 'transfer.completed':
          if (transaction.status !== TransactionStatus.SUCCESS) {
            transaction.status = TransactionStatus.SUCCESS;
            transaction.completedAt = new Date();
            transaction.flutterwaveTransactionId = data.id?.toString();
            transaction.paymentProviderResponse = data;
            await transaction.save();
            this.logger.log(`Webhook: withdrawal delivered — tx: ${transaction._id}`);
          }
          break;

        case 'transfer.failed':
        case 'transfer.reversed': {
          // Payout failed after we already debited — refund the wallet
          const alreadyRefunded = transaction.status === TransactionStatus.FAILED;
          transaction.status = TransactionStatus.FAILED;
          transaction.failureReason = data.complete_message || data.status_desc || 'Payout failed';
          transaction.paymentProviderResponse = data;
          await transaction.save();
          this.logger.warn(`Webhook: withdrawal failed — tx: ${transaction._id}, refunding wallet`);

          if (!alreadyRefunded) {
            await this.walletService.creditWallet(
              transaction.userId.toString(),
              transaction.amount,
              `Withdrawal refund — payout failed (${event})`,
              `REFUND-${transaction.flutterwaveReference}`,
            );
            this.logger.log(`Wallet refunded for failed withdrawal — user: ${transaction.userId}`);
          }
          break;
        }

        default:
          this.logger.log(`Unhandled webhook event: ${event}`);
      }
    } catch (error) {
      this.logger.error('Webhook handling error:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // EXISTING — queries (unchanged)
  // ════════════════════════════════════════════════════════════════════════

  async getTransactionByReference(txRef: string, userId: string): Promise<Transaction> {
    this.logger.log(`Finding transaction by reference: ${txRef}`);
    const transaction = await this.transactionModel
      .findOne({ flutterwaveReference: txRef, userId: new Types.ObjectId(userId) })
      .populate('propertyId', 'title images address')
      .populate('bookingId', 'checkIn checkOut nights priceBreakdown status')
      .populate('subscriptionId')
      .populate('boostId')
      .exec();
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }

  async getUserTransactions(
    userId: string,
    query: TransactionQueryDto,
  ): Promise<{ transactions: Transaction[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 20, status, type, paymentMethod, startDate, endDate } = query;
    const skip = (page - 1) * limit;
    const filter: any = { userId: new Types.ObjectId(userId) };

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .populate('propertyId', 'title images address')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.transactionModel.countDocuments(filter),
    ]);

    return { transactions, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getTransactionById(transactionId: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionModel
      .findOne({ _id: transactionId, userId: new Types.ObjectId(userId) })
      .populate('propertyId', 'title images address')
      .populate('bookingId', 'checkIn checkOut nights priceBreakdown status paymentStatus')
      .populate('subscriptionId')
      .populate('boostId')
      .exec();
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }

  // ════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════

  /**
   * NOW IMPLEMENTED — was empty before.
   * Dispatches to the correct post-payment handler based on transaction type.
   */
  private async processSuccessfulPayment(transaction: TransactionDocument): Promise<void> {
    this.logger.log(`Processing successful payment: ${transaction._id} | type: ${transaction.type}`);

    switch (transaction.type) {
      case TransactionType.BOOKING:
        await this.confirmBookingPayment(transaction);
        break;

      // Subscription and boost cases are handled by their own services
      // which listen for transaction success via their own flows.
      // Add cases here if you want PaymentsService to own that logic too.
      default:
        this.logger.log(`No post-payment action for type: ${transaction.type}`);
    }
  }

  /**
   * Marks the booking as paid and auto-confirms if instant-bookable.
   */
  private async confirmBookingPayment(transaction: TransactionDocument): Promise<void> {
    if (!transaction.bookingId) return;

    const booking = await this.bookingModel
      .findById(transaction.bookingId)
      .populate('propertyId', 'isInstantBookable')
      .exec();

    if (!booking) {
      this.logger.error(`Booking not found for tx: ${transaction._id}`);
      return;
    }

    // Idempotency
    if (booking.paymentStatus === PaymentStatus.PAID) {
      this.logger.log(`Booking ${booking._id} already paid — skipping`);
      return;
    }

    const update: Partial<BookingDocument> = {
      paymentStatus: PaymentStatus.PAID,
      paymentReference: transaction.flutterwaveReference,
      paymentMethod: transaction.paymentMethod,
      paidAt: transaction.completedAt ?? new Date(),
    };

    // Auto-confirm for instant-book properties
    const isInstantBookable = (booking.propertyId as any)?.isInstantBookable ?? false;
    if (isInstantBookable && booking.status === BookingStatus.PENDING) {
      update.status = BookingStatus.CONFIRMED;
      update.confirmedAt = new Date();
      update.isInstantBook = true;
      this.logger.log(`Auto-confirmed instant booking: ${booking._id}`);
    }

    await this.bookingModel.findByIdAndUpdate(booking._id, update);

    this.logger.log(
      `Booking payment confirmed | booking: ${booking._id} | ` +
      `txRef: ${transaction.flutterwaveReference} | autoConfirmed: ${isInstantBookable}`,
    );

    // ── Credit the host wallet and create a COMMISSION transaction ──────────
    const totalPaid = booking.priceBreakdown.totalAmount;
    const platformCut = Math.round(totalPaid * this.BOOKING_PLATFORM_FEE_RATE);
    const hostPayout = totalPaid - platformCut;
    const hostIdStr = booking.hostId.toString();
    const currency = (booking.currency ?? 'XAF') as Currency;

    const propertyForPayout = (booking.propertyId as any);
    const propertyTitle = propertyForPayout?.title ?? 'Property';

    // 1. Create a Transaction record under the host's account (type: COMMISSION)
    //    so it shows up in their Payment Activity tab as income.
    const commissionDesc: string = `Booking income: ${propertyTitle} - ${booking.nights} night${booking.nights !== 1 ? 's' : ''} (net after ${this.BOOKING_PLATFORM_FEE_RATE * 100}% platform fee)`;
    const commissionTx = new this.transactionModel({
      userId: booking.hostId,
      bookingId: booking._id,
      propertyId: booking.propertyId,
      amount: hostPayout,
      currency,
      type: TransactionType.COMMISSION,
      status: TransactionStatus.SUCCESS,
      paymentMethod: transaction.paymentMethod,
      flutterwaveReference: transaction.flutterwaveReference,
      description: commissionDesc,
      platformFee: platformCut,
      paymentProcessingFee: 0,
      netAmount: hostPayout,
      completedAt: new Date(),
      metadata: {
        bookingId: booking._id.toString(),
        guestTotalPaid: totalPaid,
        platformFee: platformCut,
        hostPayout,
        checkIn: booking.checkIn.toISOString(),
        checkOut: booking.checkOut.toISOString(),
      },
    });
    await commissionTx.save();

    // 2. Credit the host's wallet balance.
    await this.walletService.creditWallet(
      hostIdStr,
      hostPayout,
      commissionDesc,
      transaction.flutterwaveReference ?? undefined,
      commissionTx._id as Types.ObjectId,
    );

    this.logger.log(
      `Host payout | host: ${hostIdStr} | payout: ${hostPayout} ${currency} | ` +
      `platform fee: ${platformCut} | booking: ${booking._id}`,
    );

    // ── Notify host that payment came in ─────────────────────────────────────
    const guest = await this.userModel.findById(booking.guestId).select('name').lean();

    await this.notificationsService.notifyPaymentReceived(hostIdStr, {
      bookingId: booking._id.toString(),
      propertyTitle,
      guestName: (guest as any)?.name ?? 'A guest',
      amount: hostPayout,
      currency,
    });
  }

  private generateTransactionReference(type: TransactionType): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const typePrefix = type.substring(0, 3).toUpperCase();
    return `HH-${typePrefix}-${timestamp}-${random}`;
  }

  private calculateFees(
    amount: number,
    paymentMethod: PaymentMethod,
  ): { platformFee: number; paymentProcessingFee: number; netAmount: number } {
    let paymentProcessingFee = 0;
    switch (paymentMethod) {
      case PaymentMethod.MTN_MOMO:
      case PaymentMethod.ORANGE_MONEY:
        paymentProcessingFee = amount * 0.015;
        break;
      case PaymentMethod.CARD:
        paymentProcessingFee = amount * 0.014 + 100;
        break;
      case PaymentMethod.BANK_TRANSFER:
        paymentProcessingFee = amount * 0.01;
        break;
      default:
        paymentProcessingFee = 0;
    }
    const platformFee = 0;
    const netAmount = amount - platformFee - paymentProcessingFee;
    return { platformFee, paymentProcessingFee, netAmount };
  }

  private getTransactionDescription(dto: InitializePaymentDto): string {
    switch (dto.type) {
      case TransactionType.SUBSCRIPTION: return `Subscription: ${dto.subscriptionPlan} (${dto.billingCycle})`;
      case TransactionType.LISTING_FEE: return 'Property Listing Fee';
      case TransactionType.BOOST_LISTING: return `Listing Boost: ${dto.boostType} (${dto.boostDuration}h)`;
      case TransactionType.DIGITAL_SERVICE: return dto.description || 'Digital Service';
      default: return 'HoroHouse Payment';
    }
  }

  private getPaymentOptions(paymentMethod: PaymentMethod): string {
    switch (paymentMethod) {
      case PaymentMethod.CARD: return 'card';
      case PaymentMethod.BANK_TRANSFER: return 'account,banktransfer';
      case PaymentMethod.MTN_MOMO:
      case PaymentMethod.ORANGE_MONEY:
        return 'mobilemoneyrwanda,mobilemoneyuganda,mobilemoneyzambia,mobilemoneyghana,mobilemoneytanzania,mobilemoneyfranco,mpesa,qr,ussd,barter,nqr';
      default: return 'card,mobilemoney,account,banktransfer';
    }
  }

  /**
   * Maps Flutterwave payment_type string back to our PaymentMethod enum.
   * Used to update the transaction with the actual method the user chose.
   */
  private mapFlwPaymentType(paymentType: string): PaymentMethod {
    if (!paymentType) return PaymentMethod.CARD;
    const t = paymentType.toLowerCase();
    if (t.includes('mtn')) return PaymentMethod.MTN_MOMO;
    if (t.includes('orange')) return PaymentMethod.ORANGE_MONEY;
    if (t.includes('mobile') || t.includes('momo')) return PaymentMethod.MTN_MOMO;
    if (t.includes('bank') || t.includes('transfer') || t.includes('account')) return PaymentMethod.BANK_TRANSFER;
    return PaymentMethod.CARD;
  }
}