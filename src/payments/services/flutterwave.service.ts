// flutterwave.service.ts - FIXED VERSION

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface FlutterwavePaymentPayload {
  tx_ref: string;
  amount: number;
  currency: string;
  redirect_url: string;
  customer: {
    email: string;
    phonenumber: string;
    name: string;
  };
  customizations: {
    title: string;
    description: string;
    logo?: string;
  };
  payment_options?: string;
  meta?: Record<string, any>;
}

export interface FlutterwaveResponse {
  status: string;
  message: string;
  data: {
    link: string;
    [key: string]: any;
  };
}

export interface FlutterwaveVerificationResponse {
  status: string;
  message: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    charged_amount: number;
    app_fee: number;
    merchant_fee: number;
    status: string;
    payment_type: string;
    created_at: string;
    customer: {
      id: number;
      name: string;
      email: string;
      phone_number: string;
    };
    [key: string]: any;
  };
}

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly encryptionKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('FLUTTERWAVE_SECRET_KEY')!;
    this.publicKey = this.configService.get<string>('FLUTTERWAVE_PUBLIC_KEY')!;
    this.encryptionKey = this.configService.get<string>('FLUTTERWAVE_ENCRYPTION_KEY')!;
    this.webhookSecret = this.configService.get<string>('FLUTTERWAVE_WEBHOOK_SECRET')!;
    
    const environment = this.configService.get<string>('NODE_ENV');
    this.baseUrl = environment === 'production'
      ? 'https://api.flutterwave.com/v3'
      : 'https://api.flutterwave.com/v3';

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.logger.log(`Flutterwave Service initialized (${environment} mode)`);
  }

  /**
   * Initialize payment - Standard Flow
   * Works for all payment methods (Card, Mobile Money, Bank Transfer)
   */
  async initializePayment(
    payload: FlutterwavePaymentPayload,
  ): Promise<FlutterwaveResponse> {
    try {
      this.logger.log(`Initializing payment: ${JSON.stringify(payload)}`);

      // ✅ FIX: Don't add default payment options - let it be controlled by caller
      const response = await this.axiosInstance.post<FlutterwaveResponse>(
        '/payments',
        payload,
      );

      if (response.data.status === 'success') {
        this.logger.log(`Payment initialized successfully: ${response.data.data.link}`);
        return response.data;
      }

      throw new BadRequestException(response.data.message || 'Payment initialization failed');
    } catch (error: any) {
      this.logger.error('Payment initialization error:', error.response?.data || error.message);
      throw new BadRequestException(
        error.response?.data?.message || 'Failed to initialize payment',
      );
    }
  }

  /**
   * ✅ FIXED: Initialize Mobile Money Payment for Cameroon (MTN, Orange)
   * Uses standard hosted checkout - user selects mobile money on Flutterwave page
   */
  async initializeMobileMoneyPayment(
    amount: number,
    phoneNumber: string,
    currency: string,
    email: string,
    txRef: string,
    network: 'MTN' | 'ORANGE',
  ): Promise<any> {
    try {
      this.logger.log(`Initializing ${network} Mobile Money payment for ${phoneNumber}`);

      // ✅ FIX: Use standard payment flow with proper payment options
      // Flutterwave will show mobile money options on their hosted page
      const payload = {
        tx_ref: txRef,
        amount,
        currency,
        redirect_url: this.configService.get<string>('FRONTEND_URL') + '/payment/callback',
        customer: {
          email,
          phonenumber: phoneNumber,
          name: 'Customer',
        },
        customizations: {
          title: 'HoroHouse Payment',
          description: `${network} Mobile Money Payment`,
          logo: this.configService.get<string>('APP_LOGO_URL'),
        },
        // ✅ FIX: Show all payment options, user will select mobile money
        // Flutterwave doesn't have direct Cameroon mobile money in payment_options
        payment_options: 'card,banktransfer,ussd,mobilemoney',
        meta: {
          network,
          phone: phoneNumber,
          country: 'CM', // Cameroon
        },
      };

      const response = await this.axiosInstance.post('/payments', payload);

      this.logger.log(`Mobile Money payment response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error: any) {
      this.logger.error('Mobile Money payment error:', error.response?.data || error.message);
      throw new BadRequestException(
        error.response?.data?.message || 'Failed to initialize Mobile Money payment',
      );
    }
  }

  /**
   * Verify payment transaction
   */
  async verifyPayment(transactionId: string): Promise<FlutterwaveVerificationResponse> {
    try {
      this.logger.log(`Verifying payment: ${transactionId}`);

      const response = await this.axiosInstance.get<FlutterwaveVerificationResponse>(
        `/transactions/${transactionId}/verify`,
      );

      this.logger.log(`Payment verification response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error: any) {
      this.logger.error('Payment verification error:', error.response?.data || error.message);
      throw new BadRequestException(
        error.response?.data?.message || 'Failed to verify payment',
      );
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(signature: string, payload: any): boolean {
    try {
      const hash = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return hash === signature;
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/transactions/${transactionId}/verify`);
      return response.data;
    } catch (error: any) {
      this.logger.error('Get transaction error:', error.response?.data || error.message);
      throw new BadRequestException('Failed to get transaction details');
    }
  }

  /**
   * Initiate bank transfer
   */
  async initiateBankTransfer(payload: any): Promise<any> {
    try {
      this.logger.log('Initiating bank transfer');
      const response = await this.axiosInstance.post('/transfers', payload);
      return response.data;
    } catch (error: any) {
      this.logger.error('Bank transfer error:', error.response?.data || error.message);
      throw new BadRequestException('Failed to initiate bank transfer');
    }
  }

  /**
   * Get banks list (for bank transfers)
   */
  async getBanksList(country: string = 'CM'): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/banks/${country}`);
      return response.data;
    } catch (error: any) {
      this.logger.error('Get banks list error:', error.response?.data || error.message);
      throw new BadRequestException('Failed to get banks list');
    }
  }

  /**
   * Validate bank account
   */
  async validateBankAccount(
    accountNumber: string,
    accountBank: string,
  ): Promise<any> {
    try {
      const response = await this.axiosInstance.post('/accounts/resolve', {
        account_number: accountNumber,
        account_bank: accountBank,
      });
      return response.data;
    } catch (error: any) {
      this.logger.error('Validate bank account error:', error.response?.data || error.message);
      throw new BadRequestException('Failed to validate bank account');
    }
  }

  /**
   * Create refund
   */
  async createRefund(transactionId: string, amount?: number): Promise<any> {
    try {
      this.logger.log(`Creating refund for transaction: ${transactionId}`);
      const payload: any = { id: transactionId };
      if (amount) payload.amount = amount;

      const response = await this.axiosInstance.post('/transactions/refund', payload);
      return response.data;
    } catch (error: any) {
      this.logger.error('Refund error:', error.response?.data || error.message);
      throw new BadRequestException('Failed to create refund');
    }
  }

  /**
   * Get payment link for specific payment method
   */
  getPaymentLink(
    amount: number,
    currency: string,
    email: string,
    txRef: string,
    paymentMethod: string,
  ): string {
    const baseUrl = 'https://checkout.flutterwave.com/v3/hosted/pay';
    const params = new URLSearchParams({
      public_key: this.publicKey,
      tx_ref: txRef,
      amount: amount.toString(),
      currency,
      payment_options: paymentMethod,
      customer_email: email,
      redirect_url: this.configService.get<string>('FRONTEND_URL') + '/payment/callback',
    });

    return `${baseUrl}?${params.toString()}`;
  }
}