import { Model } from 'mongoose';
import { SplitPayment, SplitPaymentDocument, SplitPaymentStatus } from './schemas/split-payment.schema';
import { CreateSplitPaymentDto, RecordTenantPaymentDto, InitiateTenantChargeDto, SplitRentCalculatorDto } from './dto/split-payment.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { FlutterwaveService } from '../payments/services/flutterwave.service';
export declare class SplitPaymentsService {
    private splitPaymentModel;
    private userModel;
    private notificationsService;
    private flutterwaveService;
    private readonly logger;
    constructor(splitPaymentModel: Model<SplitPaymentDocument>, userModel: Model<UserDocument>, notificationsService: NotificationsService, flutterwaveService: FlutterwaveService);
    calculateSplit(dto: SplitRentCalculatorDto): {
        totalRent: number;
        numberOfTenants: number;
        shares: Array<{
            tenantIndex: number;
            amount: number;
            percentage: number;
        }>;
        remainder: number;
    };
    createCycle(landlordUserId: string, dto: CreateSplitPaymentDto): Promise<SplitPayment>;
    findById(cycleId: string): Promise<SplitPayment>;
    findByLease(leaseId: string): Promise<SplitPayment[]>;
    findMyPayments(tenantUserId: string): Promise<SplitPayment[]>;
    findByLandlord(landlordUserId: string, status?: SplitPaymentStatus): Promise<SplitPayment[]>;
    recordPayment(cycleId: string, dto: RecordTenantPaymentDto, requestingUserId: string): Promise<SplitPayment>;
    initiateCharge(cycleId: string, dto: InitiateTenantChargeDto, requestingUserId: string): Promise<{
        message: string;
        reference: string;
    }>;
    markDisbursed(cycleId: string, adminUserId: string, disbursementTransactionId?: string): Promise<SplitPayment>;
    markOverdueShares(): Promise<void>;
    private deriveCycleStatus;
    private notifyTenantsOfNewCycle;
}
