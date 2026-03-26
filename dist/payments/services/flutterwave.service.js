"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FlutterwaveService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlutterwaveService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const crypto = require("crypto");
let FlutterwaveService = FlutterwaveService_1 = class FlutterwaveService {
    configService;
    logger = new common_1.Logger(FlutterwaveService_1.name);
    axiosInstance;
    secretKey;
    publicKey;
    encryptionKey;
    webhookSecret;
    baseUrl;
    constructor(configService) {
        this.configService = configService;
        this.secretKey = this.configService.get('FLUTTERWAVE_SECRET_KEY');
        this.publicKey = this.configService.get('FLUTTERWAVE_PUBLIC_KEY');
        this.encryptionKey = this.configService.get('FLUTTERWAVE_ENCRYPTION_KEY');
        this.webhookSecret = this.configService.get('FLUTTERWAVE_WEBHOOK_SECRET');
        const environment = this.configService.get('NODE_ENV');
        this.baseUrl = environment === 'production'
            ? 'https://api.flutterwave.com/v3'
            : 'https://api.flutterwave.com/v3';
        this.axiosInstance = axios_1.default.create({
            baseURL: this.baseUrl,
            headers: {
                Authorization: `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
        this.logger.log(`Flutterwave Service initialized (${environment} mode)`);
    }
    async initializePayment(payload) {
        try {
            this.logger.log(`Initializing payment: ${JSON.stringify(payload)}`);
            const response = await this.axiosInstance.post('/payments', payload);
            if (response.data.status === 'success') {
                this.logger.log(`Payment initialized successfully: ${response.data.data.link}`);
                return response.data;
            }
            throw new common_1.BadRequestException(response.data.message || 'Payment initialization failed');
        }
        catch (error) {
            this.logger.error('Payment initialization error:', error.response?.data || error.message);
            throw new common_1.BadRequestException(error.response?.data?.message || 'Failed to initialize payment');
        }
    }
    async initializeMobileMoneyPayment(amount, phoneNumber, currency, email, txRef, network) {
        try {
            this.logger.log(`Initializing ${network} Mobile Money payment for ${phoneNumber}`);
            const payload = {
                tx_ref: txRef,
                amount,
                currency,
                redirect_url: this.configService.get('FRONTEND_URL') + '/payment/callback',
                customer: {
                    email,
                    phonenumber: phoneNumber,
                    name: 'Customer',
                },
                customizations: {
                    title: 'HoroHouse Payment',
                    description: `${network} Mobile Money Payment`,
                    logo: this.configService.get('APP_LOGO_URL'),
                },
                payment_options: 'card,banktransfer,ussd,mobilemoney',
                meta: {
                    network,
                    phone: phoneNumber,
                    country: 'CM',
                },
            };
            const response = await this.axiosInstance.post('/payments', payload);
            this.logger.log(`Mobile Money payment response: ${JSON.stringify(response.data)}`);
            return response.data;
        }
        catch (error) {
            this.logger.error('Mobile Money payment error:', error.response?.data || error.message);
            throw new common_1.BadRequestException(error.response?.data?.message || 'Failed to initialize Mobile Money payment');
        }
    }
    async verifyPayment(transactionId) {
        try {
            this.logger.log(`Verifying payment: ${transactionId}`);
            const response = await this.axiosInstance.get(`/transactions/${transactionId}/verify`);
            this.logger.log(`Payment verification response: ${JSON.stringify(response.data)}`);
            return response.data;
        }
        catch (error) {
            this.logger.error('Payment verification error:', error.response?.data || error.message);
            throw new common_1.BadRequestException(error.response?.data?.message || 'Failed to verify payment');
        }
    }
    verifyWebhookSignature(signature, payload) {
        try {
            const hash = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(JSON.stringify(payload))
                .digest('hex');
            return hash === signature;
        }
        catch (error) {
            this.logger.error('Webhook signature verification failed:', error);
            return false;
        }
    }
    async getTransaction(transactionId) {
        try {
            const response = await this.axiosInstance.get(`/transactions/${transactionId}/verify`);
            return response.data;
        }
        catch (error) {
            this.logger.error('Get transaction error:', error.response?.data || error.message);
            throw new common_1.BadRequestException('Failed to get transaction details');
        }
    }
    async initiateBankTransfer(payload) {
        try {
            this.logger.log('Initiating bank transfer');
            const response = await this.axiosInstance.post('/transfers', payload);
            return response.data;
        }
        catch (error) {
            this.logger.error('Bank transfer error:', error.response?.data || error.message);
            throw new common_1.BadRequestException('Failed to initiate bank transfer');
        }
    }
    async getBanksList(country = 'CM') {
        try {
            const response = await this.axiosInstance.get(`/banks/${country}`);
            return response.data;
        }
        catch (error) {
            this.logger.error('Get banks list error:', error.response?.data || error.message);
            throw new common_1.BadRequestException('Failed to get banks list');
        }
    }
    async validateBankAccount(accountNumber, accountBank) {
        try {
            const response = await this.axiosInstance.post('/accounts/resolve', {
                account_number: accountNumber,
                account_bank: accountBank,
            });
            return response.data;
        }
        catch (error) {
            this.logger.error('Validate bank account error:', error.response?.data || error.message);
            throw new common_1.BadRequestException('Failed to validate bank account');
        }
    }
    async createRefund(transactionId, amount) {
        try {
            this.logger.log(`Creating refund for transaction: ${transactionId}`);
            const payload = { id: transactionId };
            if (amount)
                payload.amount = amount;
            const response = await this.axiosInstance.post('/transactions/refund', payload);
            return response.data;
        }
        catch (error) {
            this.logger.error('Refund error:', error.response?.data || error.message);
            throw new common_1.BadRequestException('Failed to create refund');
        }
    }
    getPaymentLink(amount, currency, email, txRef, paymentMethod) {
        const baseUrl = 'https://checkout.flutterwave.com/v3/hosted/pay';
        const params = new URLSearchParams({
            public_key: this.publicKey,
            tx_ref: txRef,
            amount: amount.toString(),
            currency,
            payment_options: paymentMethod,
            customer_email: email,
            redirect_url: this.configService.get('FRONTEND_URL') + '/payment/callback',
        });
        return `${baseUrl}?${params.toString()}`;
    }
};
exports.FlutterwaveService = FlutterwaveService;
exports.FlutterwaveService = FlutterwaveService = FlutterwaveService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FlutterwaveService);
//# sourceMappingURL=flutterwave.service.js.map