import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { FlutterwaveService } from './flutterwave.service';
import { WalletService } from './wallet.service';
import { Transaction, TransactionDocument } from '../schemas/transaction.schema';
import { BookingDocument } from '../../bookings/schema/booking.schema';
import { InitializePaymentDto, VerifyPaymentDto, TransactionQueryDto } from '../dto/payment.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
export declare class PaymentsService {
    private transactionModel;
    private bookingModel;
    private userModel;
    private readonly notificationsService;
    private flutterwaveService;
    private configService;
    private walletService;
    private readonly logger;
    private readonly BOOKING_PLATFORM_FEE_RATE;
    constructor(transactionModel: Model<TransactionDocument>, bookingModel: Model<BookingDocument>, userModel: Model<UserDocument>, notificationsService: NotificationsService, flutterwaveService: FlutterwaveService, configService: ConfigService, walletService: WalletService);
    private resolveCustomerEmail;
    initializePayment(dto: InitializePaymentDto, user: User): Promise<{
        transaction: TransactionDocument;
        paymentLink: string;
    }>;
    initiateBookingPayment(bookingId: string, user: User): Promise<{
        transaction: TransactionDocument;
        paymentLink: string;
        txRef: string;
    }>;
    verifyPayment(dto: VerifyPaymentDto, user: User): Promise<Transaction>;
    handleWebhook(payload: any, signature: string): Promise<void>;
    getTransactionByReference(txRef: string, userId: string): Promise<Transaction>;
    getUserTransactions(userId: string, query: TransactionQueryDto): Promise<{
        transactions: Transaction[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getTransactionById(transactionId: string, userId: string): Promise<Transaction>;
    private processSuccessfulPayment;
    private confirmBookingPayment;
    private generateTransactionReference;
    private calculateFees;
    private getTransactionDescription;
    private getPaymentOptions;
    private mapFlwPaymentType;
}
