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
var SubscriptionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const schedule_1 = require("@nestjs/schedule");
const subscription_schema_1 = require("../schemas/subscription.schema");
const subscription_plan_schema_1 = require("../schemas/subscription-plan.schema");
const transaction_schema_1 = require("../schemas/transaction.schema");
let SubscriptionsService = SubscriptionsService_1 = class SubscriptionsService {
    subscriptionModel;
    subscriptionPlanModel;
    transactionModel;
    logger = new common_1.Logger(SubscriptionsService_1.name);
    constructor(subscriptionModel, subscriptionPlanModel, transactionModel) {
        this.subscriptionModel = subscriptionModel;
        this.subscriptionPlanModel = subscriptionPlanModel;
        this.transactionModel = transactionModel;
        this.initializeDefaultPlans();
    }
    async initializeDefaultPlans() {
        const plans = await this.subscriptionPlanModel.countDocuments();
        if (plans === 0) {
            const defaultPlans = this.getDefaultPlans();
            await this.subscriptionPlanModel.insertMany(defaultPlans);
            this.logger.log('Default subscription plans initialized');
        }
    }
    getDefaultPlans() {
        return [
            {
                name: subscription_schema_1.SubscriptionPlan.FREE,
                displayName: 'Free',
                description: 'Perfect for getting started',
                highlights: ['3 listings per month', 'Basic support', 'Standard visibility'],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 0,
                    [subscription_schema_1.BillingCycle.YEARLY]: 0,
                },
                features: {
                    maxListings: 3,
                    maxActiveListings: 3,
                    canBoostListings: false,
                    boostsPerMonth: 0,
                    prioritySupport: false,
                    analytics: false,
                    apiAccess: false,
                    teamMembers: 1,
                    virtualTours: false,
                    professionalPhotography: false,
                    featuredListings: 0,
                    socialMediaIntegration: false,
                    leadGeneration: false,
                    whiteLabel: false,
                },
                displayOrder: 1,
                isActive: true,
                isPublic: true,
            },
            {
                name: subscription_schema_1.SubscriptionPlan.PROFESSIONAL,
                displayName: 'Professional',
                description: 'For serious agents and property owners',
                highlights: [
                    '10 listings per month',
                    'Priority support',
                    'Basic analytics',
                    '2 free boosts/month',
                ],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 15000,
                    [subscription_schema_1.BillingCycle.QUARTERLY]: 40000,
                    [subscription_schema_1.BillingCycle.YEARLY]: 150000,
                },
                features: {
                    maxListings: 10,
                    maxActiveListings: 10,
                    canBoostListings: true,
                    boostsPerMonth: 2,
                    prioritySupport: true,
                    analytics: true,
                    apiAccess: false,
                    teamMembers: 1,
                    virtualTours: true,
                    professionalPhotography: false,
                    featuredListings: 1,
                    socialMediaIntegration: true,
                    leadGeneration: true,
                    whiteLabel: false,
                },
                displayOrder: 2,
                isActive: true,
                isPublic: true,
                isPopular: true,
            },
            {
                name: subscription_schema_1.SubscriptionPlan.AGENCY,
                displayName: 'Agency',
                description: 'For real estate agencies and teams',
                highlights: [
                    'Unlimited listings',
                    'Priority support 24/7',
                    'Advanced analytics',
                    '10 free boosts/month',
                    'Team collaboration',
                ],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 50000,
                    [subscription_schema_1.BillingCycle.QUARTERLY]: 135000,
                    [subscription_schema_1.BillingCycle.YEARLY]: 500000,
                },
                features: {
                    maxListings: -1,
                    maxActiveListings: -1,
                    canBoostListings: true,
                    boostsPerMonth: 10,
                    prioritySupport: true,
                    analytics: true,
                    apiAccess: true,
                    teamMembers: 5,
                    virtualTours: true,
                    professionalPhotography: true,
                    featuredListings: 5,
                    socialMediaIntegration: true,
                    leadGeneration: true,
                    whiteLabel: false,
                },
                displayOrder: 3,
                isActive: true,
                isPublic: true,
            },
            {
                name: subscription_schema_1.SubscriptionPlan.ENTERPRISE,
                displayName: 'Enterprise',
                description: 'Custom solutions for large organizations',
                highlights: [
                    'Everything in Agency',
                    'Dedicated account manager',
                    'Custom integrations',
                    'White-label options',
                    'API access',
                ],
                pricing: {
                    [subscription_schema_1.BillingCycle.MONTHLY]: 150000,
                    [subscription_schema_1.BillingCycle.QUARTERLY]: 400000,
                    [subscription_schema_1.BillingCycle.YEARLY]: 1500000,
                },
                features: {
                    maxListings: -1,
                    maxActiveListings: -1,
                    canBoostListings: true,
                    boostsPerMonth: -1,
                    prioritySupport: true,
                    analytics: true,
                    apiAccess: true,
                    teamMembers: -1,
                    virtualTours: true,
                    professionalPhotography: true,
                    featuredListings: -1,
                    socialMediaIntegration: true,
                    leadGeneration: true,
                    whiteLabel: true,
                },
                displayOrder: 4,
                isActive: true,
                isPublic: true,
            },
        ];
    }
    async getPlans() {
        return this.subscriptionPlanModel
            .find({ isActive: true, isPublic: true })
            .sort({ displayOrder: 1 })
            .exec();
    }
    async getUserSubscription(userId) {
        return this.subscriptionModel
            .findOne({
            userId: new mongoose_2.Types.ObjectId(userId),
            status: { $in: [subscription_schema_1.SubscriptionStatus.ACTIVE, subscription_schema_1.SubscriptionStatus.PENDING] },
        })
            .populate('lastPaymentTransactionId')
            .sort({ createdAt: -1 })
            .exec();
    }
    async activateSubscription(transactionId) {
        try {
            this.logger.log(`Activating subscription for transaction: ${transactionId}`);
            const transaction = await this.transactionModel
                .findById(transactionId)
                .exec();
            if (!transaction) {
                throw new common_1.NotFoundException('Transaction not found');
            }
            if (transaction.type !== transaction_schema_1.TransactionType.SUBSCRIPTION) {
                throw new common_1.BadRequestException('Transaction is not for subscription');
            }
            const planName = transaction.metadata?.planName;
            const billingCycle = transaction.metadata?.billingCycle;
            if (!planName || !billingCycle) {
                throw new common_1.BadRequestException('Missing subscription details in transaction');
            }
            const plan = await this.subscriptionPlanModel.findOne({ name: planName });
            if (!plan) {
                throw new common_1.NotFoundException('Subscription plan not found');
            }
            const startDate = new Date();
            const endDate = this.calculateEndDate(startDate, billingCycle);
            const nextBillingDate = this.calculateNextBillingDate(endDate, billingCycle);
            const existingSubscription = await this.getUserSubscription(transaction.userId.toString());
            if (existingSubscription) {
                existingSubscription.status = subscription_schema_1.SubscriptionStatus.CANCELLED;
                existingSubscription.cancelledAt = new Date();
                existingSubscription.cancellationReason = 'Upgraded to new plan';
                await existingSubscription.save();
            }
            const subscription = new this.subscriptionModel({
                userId: transaction.userId,
                plan: planName,
                status: subscription_schema_1.SubscriptionStatus.ACTIVE,
                billingCycle,
                price: transaction.amount,
                currency: transaction.currency,
                features: plan.features,
                startDate,
                endDate,
                nextBillingDate,
                autoRenew: true,
                lastPaymentTransactionId: transaction._id,
                lastPaymentDate: new Date(),
                previousSubscriptionId: existingSubscription?._id,
                upgradedFrom: existingSubscription?.plan,
            });
            await subscription.save();
            transaction.subscriptionId = subscription._id;
            await transaction.save();
            this.logger.log(`Subscription activated: ${subscription._id}`);
            return subscription;
        }
        catch (error) {
            this.logger.error('Activate subscription error:', error);
            throw error;
        }
    }
    async cancelSubscription(userId, cancelDto) {
        const subscription = await this.getUserSubscription(userId);
        if (!subscription) {
            throw new common_1.NotFoundException('No active subscription found');
        }
        subscription.status = cancelDto.cancelImmediately
            ? subscription_schema_1.SubscriptionStatus.CANCELLED
            : subscription_schema_1.SubscriptionStatus.ACTIVE;
        subscription.autoRenew = false;
        subscription.cancelledAt = new Date();
        subscription.cancellationReason = cancelDto.reason;
        await subscription.save();
        this.logger.log(`Subscription cancelled: ${subscription._id}`);
        return subscription;
    }
    async checkUsageLimit(userId, resourceType) {
        const subscription = await this.getUserSubscription(userId);
        if (!subscription || subscription.status !== subscription_schema_1.SubscriptionStatus.ACTIVE) {
            return {
                canUse: false,
                remaining: 0,
                limit: resourceType === 'listings' ? 3 : 0,
            };
        }
        const limit = resourceType === 'listings'
            ? subscription.features.maxListings
            : subscription.features.boostsPerMonth;
        if (limit === undefined) {
            return {
                canUse: false,
                remaining: 0,
                limit: 0,
            };
        }
        const used = resourceType === 'listings'
            ? subscription.listingsUsed
            : subscription.boostsUsed;
        const remaining = limit === -1 ? Infinity : limit - used;
        const canUse = limit === -1 || used < limit;
        return { canUse, remaining, limit };
    }
    async incrementUsage(userId, resourceType) {
        const subscription = await this.getUserSubscription(userId);
        if (subscription) {
            if (resourceType === 'listings') {
                subscription.listingsUsed += 1;
            }
            else if (resourceType === 'boosts') {
                subscription.boostsUsed += 1;
            }
            await subscription.save();
        }
    }
    async checkExpiredSubscriptions() {
        try {
            this.logger.log('Running subscription expiration check');
            const expiredSubscriptions = await this.subscriptionModel.find({
                status: subscription_schema_1.SubscriptionStatus.ACTIVE,
                endDate: { $lte: new Date() },
            });
            for (const subscription of expiredSubscriptions) {
                if (subscription.autoRenew) {
                    this.logger.log(`Auto-renewal needed for subscription: ${subscription._id}`);
                }
                else {
                    subscription.status = subscription_schema_1.SubscriptionStatus.EXPIRED;
                    await subscription.save();
                    this.logger.log(`Subscription expired: ${subscription._id}`);
                }
            }
            this.logger.log(`Processed ${expiredSubscriptions.length} expired subscriptions`);
        }
        catch (error) {
            this.logger.error('Error checking expired subscriptions:', error);
        }
    }
    async resetMonthlyUsage() {
        try {
            this.logger.log('Resetting monthly usage counters');
            await this.subscriptionModel.updateMany({ status: subscription_schema_1.SubscriptionStatus.ACTIVE }, { $set: { listingsUsed: 0, boostsUsed: 0 } });
            this.logger.log('Monthly usage counters reset successfully');
        }
        catch (error) {
            this.logger.error('Error resetting monthly usage:', error);
        }
    }
    calculateEndDate(startDate, billingCycle) {
        const endDate = new Date(startDate);
        switch (billingCycle) {
            case subscription_schema_1.BillingCycle.MONTHLY:
                endDate.setMonth(endDate.getMonth() + 1);
                break;
            case subscription_schema_1.BillingCycle.QUARTERLY:
                endDate.setMonth(endDate.getMonth() + 3);
                break;
            case subscription_schema_1.BillingCycle.YEARLY:
                endDate.setFullYear(endDate.getFullYear() + 1);
                break;
        }
        return endDate;
    }
    calculateNextBillingDate(endDate, billingCycle) {
        return new Date(endDate);
    }
};
exports.SubscriptionsService = SubscriptionsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionsService.prototype, "checkExpiredSubscriptions", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionsService.prototype, "resetMonthlyUsage", null);
exports.SubscriptionsService = SubscriptionsService = SubscriptionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(subscription_schema_1.Subscription.name)),
    __param(1, (0, mongoose_1.InjectModel)(subscription_plan_schema_1.SubscriptionPlanModel.name)),
    __param(2, (0, mongoose_1.InjectModel)(transaction_schema_1.Transaction.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], SubscriptionsService);
//# sourceMappingURL=subscriptions.service.js.map