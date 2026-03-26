import { ConfigService } from '@nestjs/config';
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
export declare class FlutterwaveService {
    private configService;
    private readonly logger;
    private readonly axiosInstance;
    private readonly secretKey;
    private readonly publicKey;
    private readonly encryptionKey;
    private readonly webhookSecret;
    private readonly baseUrl;
    constructor(configService: ConfigService);
    initializePayment(payload: FlutterwavePaymentPayload): Promise<FlutterwaveResponse>;
    initializeMobileMoneyPayment(amount: number, phoneNumber: string, currency: string, email: string, txRef: string, network: 'MTN' | 'ORANGE'): Promise<any>;
    verifyPayment(transactionId: string): Promise<FlutterwaveVerificationResponse>;
    verifyWebhookSignature(signature: string, payload: any): boolean;
    getTransaction(transactionId: string): Promise<any>;
    initiateBankTransfer(payload: any): Promise<any>;
    getBanksList(country?: string): Promise<any>;
    validateBankAccount(accountNumber: string, accountBank: string): Promise<any>;
    createRefund(transactionId: string, amount?: number): Promise<any>;
    getPaymentLink(amount: number, currency: string, email: string, txRef: string, paymentMethod: string): string;
}
