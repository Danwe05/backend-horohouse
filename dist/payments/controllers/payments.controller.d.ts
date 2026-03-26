import { PaymentsService } from '../services/payments.service';
import { InitializePaymentDto, VerifyPaymentDto, TransactionQueryDto, FlutterwaveWebhookDto } from '../dto/payment.dto';
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    initializePayment(initializePaymentDto: InitializePaymentDto, req: any): Promise<{
        transaction: import("../schemas/transaction.schema").TransactionDocument;
        paymentLink: string;
    }>;
    initiateBookingPayment(bookingId: string, req: any): Promise<{
        transaction: import("../schemas/transaction.schema").TransactionDocument;
        paymentLink: string;
        txRef: string;
    }>;
    verifyPayment(verifyPaymentDto: VerifyPaymentDto, req: any): Promise<import("../schemas/transaction.schema").Transaction>;
    getUserTransactions(req: any, query: TransactionQueryDto): Promise<{
        transactions: import("../schemas/transaction.schema").Transaction[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getTransactionByReference(txRef: string, req: any): Promise<import("../schemas/transaction.schema").Transaction>;
    getTransactionById(id: string, req: any): Promise<import("../schemas/transaction.schema").Transaction>;
    handleFlutterwaveWebhook(payload: FlutterwaveWebhookDto, signature: string): Promise<{
        status: string;
        message: string;
    }>;
    getAllTransactions(query: TransactionQueryDto): Promise<{
        message: string;
    }>;
    getPaymentAnalytics(): Promise<{
        message: string;
    }>;
}
