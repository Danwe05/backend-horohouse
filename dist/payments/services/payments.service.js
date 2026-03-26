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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const config_1 = require("@nestjs/config");
const flutterwave_service_1 = require("./flutterwave.service");
const wallet_service_1 = require("./wallet.service");
const transaction_schema_1 = require("../schemas/transaction.schema");
const booking_schema_1 = require("../../bookings/schema/booking.schema");
const notifications_service_1 = require("../../notifications/notifications.service");
const user_schema_1 = require("../../users/schemas/user.schema");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    transactionModel;
    bookingModel;
    userModel;
    notificationsService;
    flutterwaveService;
    configService;
    walletService;
    logger = new common_1.Logger(PaymentsService_1.name);
    BOOKING_PLATFORM_FEE_RATE = 0.10;
    constructor(transactionModel, bookingModel, userModel, notificationsService, flutterwaveService, configService, walletService) {
        this.transactionModel = transactionModel;
        this.bookingModel = bookingModel;
        this.userModel = userModel;
        this.notificationsService = notificationsService;
        this.flutterwaveService = flutterwaveService;
        this.configService = configService;
        this.walletService = walletService;
    }
    resolveCustomerEmail(user, override) {
        if (override)
            return override;
        if (user.email)
            return user.email;
        const phone = user.phoneNumber;
        if (phone) {
            const sanitised = phone.replace(/[^a-zA-Z0-9]/g, '');
            return `${sanitised}@noreply.horohouse.com`;
        }
        throw new common_1.BadRequestException('Your account has no email address. Please add an email to your profile before making a payment.');
    }
    async initializePayment(dto, user) {
        try {
            this.logger.log(`Initializing payment for user ${user._id}: ${JSON.stringify(dto)}`);
            const txRef = this.generateTransactionReference(dto.type);
            const { platformFee, paymentProcessingFee, netAmount } = this.calculateFees(dto.amount, dto.paymentMethod);
            const transaction = new this.transactionModel({
                userId: user._id,
                amount: dto.amount,
                currency: dto.currency || transaction_schema_1.Currency.XAF,
                type: dto.type,
                status: transaction_schema_1.TransactionStatus.PENDING,
                paymentMethod: dto.paymentMethod,
                flutterwaveReference: txRef,
                propertyId: dto.propertyId ? new mongoose_2.Types.ObjectId(dto.propertyId) : undefined,
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
                currency: dto.currency || transaction_schema_1.Currency.XAF,
                redirect_url: redirectUrl,
                customer: {
                    email: this.resolveCustomerEmail(user, dto.customerEmail),
                    phonenumber: dto.customerPhone || user.phoneNumber || '',
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
            const flutterwaveResponse = await this.flutterwaveService.initializePayment(flutterwavePayload);
            const paymentLink = flutterwaveResponse.data.link;
            transaction.flutterwavePaymentLink = paymentLink;
            transaction.flutterwaveTransactionId = flutterwaveResponse.data?.id?.toString();
            transaction.paymentProviderResponse = flutterwaveResponse;
            await transaction.save();
            this.logger.log(`Payment initialized: ${transaction._id}, Link: ${paymentLink}`);
            return { transaction, paymentLink };
        }
        catch (error) {
            this.logger.error('Initialize payment error:', error);
            throw error;
        }
    }
    async initiateBookingPayment(bookingId, user) {
        this.logger.log(`Initiating booking payment | booking: ${bookingId} | user: ${user._id}`);
        const booking = await this.bookingModel
            .findById(bookingId)
            .populate('propertyId', 'title isInstantBookable')
            .exec();
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        if (booking.guestId.toString() !== user._id.toString()) {
            throw new common_1.ForbiddenException('Only the booking guest can initiate payment');
        }
        if (booking.paymentStatus === booking_schema_1.PaymentStatus.PAID) {
            throw new common_1.BadRequestException('This booking has already been paid');
        }
        if ([booking_schema_1.BookingStatus.CANCELLED, booking_schema_1.BookingStatus.REJECTED].includes(booking.status)) {
            throw new common_1.BadRequestException('Cannot pay for a cancelled or rejected booking');
        }
        const existing = await this.transactionModel.findOne({
            bookingId: new mongoose_2.Types.ObjectId(bookingId),
            status: transaction_schema_1.TransactionStatus.PENDING,
        });
        if (existing?.flutterwavePaymentLink) {
            this.logger.log(`Reusing pending transaction: ${existing._id}`);
            return {
                transaction: existing,
                paymentLink: existing.flutterwavePaymentLink,
                txRef: existing.flutterwaveReference,
            };
        }
        const txRef = this.generateTransactionReference(transaction_schema_1.TransactionType.BOOKING);
        const amount = booking.priceBreakdown.totalAmount;
        const currency = booking.currency ?? transaction_schema_1.Currency.XAF;
        const propertyTitle = booking.propertyId?.title ?? 'Property Booking';
        const { platformFee, paymentProcessingFee, netAmount } = this.calculateFees(amount, transaction_schema_1.PaymentMethod.CARD);
        const transaction = new this.transactionModel({
            userId: user._id,
            bookingId: new mongoose_2.Types.ObjectId(bookingId),
            amount,
            currency,
            type: transaction_schema_1.TransactionType.BOOKING,
            status: transaction_schema_1.TransactionStatus.PENDING,
            paymentMethod: transaction_schema_1.PaymentMethod.CARD,
            flutterwaveReference: txRef,
            description: `Booking payment: ${propertyTitle} · ${booking.nights} night${booking.nights !== 1 ? 's' : ''}`,
            platformFee,
            paymentProcessingFee,
            netAmount,
            customerName: user.name,
            customerEmail: user.email,
            customerPhone: user.phoneNumber,
            metadata: {
                bookingId,
                propertyTitle,
                checkIn: booking.checkIn.toISOString(),
                checkOut: booking.checkOut.toISOString(),
                nights: booking.nights,
            },
        });
        await transaction.save();
        const frontendUrl = this.configService.get('FRONTEND_URL');
        const flwPayload = {
            tx_ref: txRef,
            amount,
            currency,
            redirect_url: `${frontendUrl}/dashboard/bookings/${bookingId}/payment-callback`,
            customer: {
                email: this.resolveCustomerEmail(user),
                phonenumber: user.phoneNumber ?? '',
                name: user.name ?? '',
            },
            customizations: {
                title: 'HoroHouse Stay Payment',
                description: `${propertyTitle} · ${booking.nights} night${booking.nights !== 1 ? 's' : ''}`,
                logo: this.configService.get('APP_LOGO_URL'),
            },
            payment_options: 'card,mobilemoney,account,banktransfer',
            meta: {
                transactionId: transaction._id.toString(),
                bookingId,
                userId: user._id.toString(),
                type: transaction_schema_1.TransactionType.BOOKING,
            },
        };
        const flwResponse = await this.flutterwaveService.initializePayment(flwPayload);
        const paymentLink = flwResponse.data.link;
        transaction.flutterwavePaymentLink = paymentLink;
        transaction.flutterwaveTransactionId = flwResponse.data?.id?.toString();
        transaction.paymentProviderResponse = flwResponse;
        await transaction.save();
        await this.bookingModel.findByIdAndUpdate(bookingId, {
            paymentReference: txRef,
        });
        this.logger.log(`Booking payment initiated | tx: ${transaction._id} | txRef: ${txRef} | ${amount} ${currency}`);
        return { transaction, paymentLink, txRef };
    }
    async verifyPayment(dto, user) {
        try {
            this.logger.log(`Verifying payment: ${dto.transactionId}`);
            const transaction = await this.transactionModel.findOne({
                _id: dto.transactionId,
                userId: user._id,
            });
            if (!transaction)
                throw new common_1.NotFoundException('Transaction not found');
            if (transaction.status === transaction_schema_1.TransactionStatus.SUCCESS)
                return transaction;
            const flutterwaveTransactionId = transaction.flutterwaveTransactionId || dto.flutterwaveReference;
            if (!flutterwaveTransactionId) {
                throw new common_1.BadRequestException('No Flutterwave transaction ID found');
            }
            const verificationResponse = await this.flutterwaveService.verifyPayment(flutterwaveTransactionId);
            if (verificationResponse.data.status === 'successful' &&
                verificationResponse.data.amount >= transaction.amount) {
                transaction.status = transaction_schema_1.TransactionStatus.SUCCESS;
                transaction.completedAt = new Date();
                transaction.flutterwaveTransactionId = verificationResponse.data.id.toString();
                transaction.paymentProviderResponse = verificationResponse;
                await transaction.save();
                await this.processSuccessfulPayment(transaction);
                this.logger.log(`Payment verified successfully: ${transaction._id}`);
            }
            else if (verificationResponse.data.status === 'failed') {
                transaction.status = transaction_schema_1.TransactionStatus.FAILED;
                transaction.failureReason =
                    verificationResponse.data.processor_response || 'Payment failed';
                await transaction.save();
            }
            return transaction;
        }
        catch (error) {
            this.logger.error('Verify payment error:', error);
            throw error;
        }
    }
    async handleWebhook(payload, signature) {
        try {
            const isValid = this.flutterwaveService.verifyWebhookSignature(signature, payload);
            if (!isValid) {
                this.logger.error('Invalid webhook signature');
                throw new common_1.BadRequestException('Invalid webhook signature');
            }
            const { event, data } = payload;
            this.logger.log(`Webhook received: ${event}, ref: ${data.reference ?? data.tx_ref}`);
            const flwRef = data.reference ?? data.tx_ref;
            const transaction = await this.transactionModel.findOne({
                flutterwaveReference: flwRef,
            });
            if (!transaction) {
                this.logger.warn(`No transaction found for reference: ${flwRef} (event: ${event})`);
                return;
            }
            switch (event) {
                case 'charge.completed':
                    if (data.status === 'successful' && data.amount >= transaction.amount) {
                        if (transaction.status === transaction_schema_1.TransactionStatus.SUCCESS) {
                            this.logger.log(`Duplicate webhook for already-successful tx: ${transaction._id}`);
                            return;
                        }
                        transaction.status = transaction_schema_1.TransactionStatus.SUCCESS;
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
                    transaction.status = transaction_schema_1.TransactionStatus.FAILED;
                    transaction.failureReason = data.processor_response || 'Payment failed';
                    transaction.paymentProviderResponse = data;
                    await transaction.save();
                    this.logger.log(`Webhook: charge failed — tx: ${transaction._id}`);
                    break;
                case 'transfer.completed':
                    if (transaction.status !== transaction_schema_1.TransactionStatus.SUCCESS) {
                        transaction.status = transaction_schema_1.TransactionStatus.SUCCESS;
                        transaction.completedAt = new Date();
                        transaction.flutterwaveTransactionId = data.id?.toString();
                        transaction.paymentProviderResponse = data;
                        await transaction.save();
                        this.logger.log(`Webhook: withdrawal delivered — tx: ${transaction._id}`);
                    }
                    break;
                case 'transfer.failed':
                case 'transfer.reversed': {
                    const alreadyRefunded = transaction.status === transaction_schema_1.TransactionStatus.FAILED;
                    transaction.status = transaction_schema_1.TransactionStatus.FAILED;
                    transaction.failureReason = data.complete_message || data.status_desc || 'Payout failed';
                    transaction.paymentProviderResponse = data;
                    await transaction.save();
                    this.logger.warn(`Webhook: withdrawal failed — tx: ${transaction._id}, refunding wallet`);
                    if (!alreadyRefunded) {
                        await this.walletService.creditWallet(transaction.userId.toString(), transaction.amount, `Withdrawal refund — payout failed (${event})`, `REFUND-${transaction.flutterwaveReference}`);
                        this.logger.log(`Wallet refunded for failed withdrawal — user: ${transaction.userId}`);
                    }
                    break;
                }
                default:
                    this.logger.log(`Unhandled webhook event: ${event}`);
            }
        }
        catch (error) {
            this.logger.error('Webhook handling error:', error);
            throw error;
        }
    }
    async getTransactionByReference(txRef, userId) {
        this.logger.log(`Finding transaction by reference: ${txRef}`);
        const transaction = await this.transactionModel
            .findOne({ flutterwaveReference: txRef, userId: new mongoose_2.Types.ObjectId(userId) })
            .populate('propertyId', 'title images address')
            .populate('bookingId', 'checkIn checkOut nights priceBreakdown status')
            .populate('subscriptionId')
            .populate('boostId')
            .exec();
        if (!transaction)
            throw new common_1.NotFoundException('Transaction not found');
        return transaction;
    }
    async getUserTransactions(userId, query) {
        const { page = 1, limit = 20, status, type, paymentMethod, startDate, endDate } = query;
        const skip = (page - 1) * limit;
        const filter = { userId: new mongoose_2.Types.ObjectId(userId) };
        if (status)
            filter.status = status;
        if (type)
            filter.type = type;
        if (paymentMethod)
            filter.paymentMethod = paymentMethod;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate)
                filter.createdAt.$gte = new Date(startDate);
            if (endDate)
                filter.createdAt.$lte = new Date(endDate);
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
    async getTransactionById(transactionId, userId) {
        const transaction = await this.transactionModel
            .findOne({ _id: transactionId, userId: new mongoose_2.Types.ObjectId(userId) })
            .populate('propertyId', 'title images address')
            .populate('bookingId', 'checkIn checkOut nights priceBreakdown status paymentStatus')
            .populate('subscriptionId')
            .populate('boostId')
            .exec();
        if (!transaction)
            throw new common_1.NotFoundException('Transaction not found');
        return transaction;
    }
    async processSuccessfulPayment(transaction) {
        this.logger.log(`Processing successful payment: ${transaction._id} | type: ${transaction.type}`);
        switch (transaction.type) {
            case transaction_schema_1.TransactionType.BOOKING:
                await this.confirmBookingPayment(transaction);
                break;
            default:
                this.logger.log(`No post-payment action for type: ${transaction.type}`);
        }
    }
    async confirmBookingPayment(transaction) {
        if (!transaction.bookingId)
            return;
        const booking = await this.bookingModel
            .findById(transaction.bookingId)
            .populate('propertyId', 'isInstantBookable')
            .exec();
        if (!booking) {
            this.logger.error(`Booking not found for tx: ${transaction._id}`);
            return;
        }
        if (booking.paymentStatus === booking_schema_1.PaymentStatus.PAID) {
            this.logger.log(`Booking ${booking._id} already paid — skipping`);
            return;
        }
        const update = {
            paymentStatus: booking_schema_1.PaymentStatus.PAID,
            paymentReference: transaction.flutterwaveReference,
            paymentMethod: transaction.paymentMethod,
            paidAt: transaction.completedAt ?? new Date(),
        };
        const isInstantBookable = booking.propertyId?.isInstantBookable ?? false;
        if (isInstantBookable && booking.status === booking_schema_1.BookingStatus.PENDING) {
            update.status = booking_schema_1.BookingStatus.CONFIRMED;
            update.confirmedAt = new Date();
            update.isInstantBook = true;
            this.logger.log(`Auto-confirmed instant booking: ${booking._id}`);
        }
        await this.bookingModel.findByIdAndUpdate(booking._id, update);
        this.logger.log(`Booking payment confirmed | booking: ${booking._id} | ` +
            `txRef: ${transaction.flutterwaveReference} | autoConfirmed: ${isInstantBookable}`);
        const totalPaid = booking.priceBreakdown.totalAmount;
        const platformCut = Math.round(totalPaid * this.BOOKING_PLATFORM_FEE_RATE);
        const hostPayout = totalPaid - platformCut;
        const hostIdStr = booking.hostId.toString();
        const currency = (booking.currency ?? 'XAF');
        const propertyForPayout = booking.propertyId;
        const propertyTitle = propertyForPayout?.title ?? 'Property';
        const commissionDesc = `Booking income: ${propertyTitle} - ${booking.nights} night${booking.nights !== 1 ? 's' : ''} (net after ${this.BOOKING_PLATFORM_FEE_RATE * 100}% platform fee)`;
        const commissionTx = new this.transactionModel({
            userId: booking.hostId,
            bookingId: booking._id,
            propertyId: booking.propertyId,
            amount: hostPayout,
            currency,
            type: transaction_schema_1.TransactionType.COMMISSION,
            status: transaction_schema_1.TransactionStatus.SUCCESS,
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
        await this.walletService.creditWallet(hostIdStr, hostPayout, commissionDesc, transaction.flutterwaveReference ?? undefined, commissionTx._id);
        this.logger.log(`Host payout | host: ${hostIdStr} | payout: ${hostPayout} ${currency} | ` +
            `platform fee: ${platformCut} | booking: ${booking._id}`);
        const guest = await this.userModel.findById(booking.guestId).select('name').lean();
        await this.notificationsService.notifyPaymentReceived(hostIdStr, {
            bookingId: booking._id.toString(),
            propertyTitle,
            guestName: guest?.name ?? 'A guest',
            amount: hostPayout,
            currency,
        });
    }
    generateTransactionReference(type) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const typePrefix = type.substring(0, 3).toUpperCase();
        return `HH-${typePrefix}-${timestamp}-${random}`;
    }
    calculateFees(amount, paymentMethod) {
        let paymentProcessingFee = 0;
        switch (paymentMethod) {
            case transaction_schema_1.PaymentMethod.MTN_MOMO:
            case transaction_schema_1.PaymentMethod.ORANGE_MONEY:
                paymentProcessingFee = amount * 0.015;
                break;
            case transaction_schema_1.PaymentMethod.CARD:
                paymentProcessingFee = amount * 0.014 + 100;
                break;
            case transaction_schema_1.PaymentMethod.BANK_TRANSFER:
                paymentProcessingFee = amount * 0.01;
                break;
            default:
                paymentProcessingFee = 0;
        }
        const platformFee = 0;
        const netAmount = amount - platformFee - paymentProcessingFee;
        return { platformFee, paymentProcessingFee, netAmount };
    }
    getTransactionDescription(dto) {
        switch (dto.type) {
            case transaction_schema_1.TransactionType.SUBSCRIPTION: return `Subscription: ${dto.subscriptionPlan} (${dto.billingCycle})`;
            case transaction_schema_1.TransactionType.LISTING_FEE: return 'Property Listing Fee';
            case transaction_schema_1.TransactionType.BOOST_LISTING: return `Listing Boost: ${dto.boostType} (${dto.boostDuration}h)`;
            case transaction_schema_1.TransactionType.DIGITAL_SERVICE: return dto.description || 'Digital Service';
            default: return 'HoroHouse Payment';
        }
    }
    getPaymentOptions(paymentMethod) {
        switch (paymentMethod) {
            case transaction_schema_1.PaymentMethod.CARD: return 'card';
            case transaction_schema_1.PaymentMethod.BANK_TRANSFER: return 'account,banktransfer';
            case transaction_schema_1.PaymentMethod.MTN_MOMO:
            case transaction_schema_1.PaymentMethod.ORANGE_MONEY:
                return 'mobilemoneyrwanda,mobilemoneyuganda,mobilemoneyzambia,mobilemoneyghana,mobilemoneytanzania,mobilemoneyfranco,mpesa,qr,ussd,barter,nqr';
            default: return 'card,mobilemoney,account,banktransfer';
        }
    }
    mapFlwPaymentType(paymentType) {
        if (!paymentType)
            return transaction_schema_1.PaymentMethod.CARD;
        const t = paymentType.toLowerCase();
        if (t.includes('mtn'))
            return transaction_schema_1.PaymentMethod.MTN_MOMO;
        if (t.includes('orange'))
            return transaction_schema_1.PaymentMethod.ORANGE_MONEY;
        if (t.includes('mobile') || t.includes('momo'))
            return transaction_schema_1.PaymentMethod.MTN_MOMO;
        if (t.includes('bank') || t.includes('transfer') || t.includes('account'))
            return transaction_schema_1.PaymentMethod.BANK_TRANSFER;
        return transaction_schema_1.PaymentMethod.CARD;
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __param(1, (0, mongoose_1.InjectModel)(booking_schema_1.Booking.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        notifications_service_1.NotificationsService,
        flutterwave_service_1.FlutterwaveService,
        config_1.ConfigService,
        wallet_service_1.WalletService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map