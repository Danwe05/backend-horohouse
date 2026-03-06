import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionPlan,
  SubscriptionStatus,
  BillingCycle,
  SubscriptionFeatures,
} from '../schemas/subscription.schema';
import {
  SubscriptionPlanModel,
  SubscriptionPlanDocument,
} from '../schemas/subscription-plan.schema';
import { Transaction, TransactionDocument, TransactionType } from '../schemas/transaction.schema';
import { CreateSubscriptionDto, CancelSubscriptionDto } from '../dto/payment.dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionPlanModel.name) private subscriptionPlanModel: Model<SubscriptionPlanDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
  ) {
    this.initializeDefaultPlans();
  }

  /**
   * Initialize default subscription plans
   */
  private async initializeDefaultPlans(): Promise<void> {
    const plans = await this.subscriptionPlanModel.countDocuments();
    if (plans === 0) {
      const defaultPlans = this.getDefaultPlans();
      await this.subscriptionPlanModel.insertMany(defaultPlans);
      this.logger.log('Default subscription plans initialized');
    }
  }

  /**
   * Get default subscription plans configuration
   */
  private getDefaultPlans() {
    return [
      {
        name: SubscriptionPlan.FREE,
        displayName: 'Free',
        description: 'Perfect for getting started',
        highlights: ['3 listings per month', 'Basic support', 'Standard visibility'],
        pricing: {
          [BillingCycle.MONTHLY]: 0,
          [BillingCycle.YEARLY]: 0,
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
        } as SubscriptionFeatures,
        displayOrder: 1,
        isActive: true,
        isPublic: true,
      },
      {
        name: SubscriptionPlan.PROFESSIONAL,
        displayName: 'Professional',
        description: 'For serious agents and property owners',
        highlights: [
          '10 listings per month',
          'Priority support',
          'Basic analytics',
          '2 free boosts/month',
        ],
        pricing: {
          [BillingCycle.MONTHLY]: 15000,
          [BillingCycle.QUARTERLY]: 40000,
          [BillingCycle.YEARLY]: 150000,
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
        } as SubscriptionFeatures,
        displayOrder: 2,
        isActive: true,
        isPublic: true,
        isPopular: true,
      },
      {
        name: SubscriptionPlan.AGENCY,
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
          [BillingCycle.MONTHLY]: 50000,
          [BillingCycle.QUARTERLY]: 135000,
          [BillingCycle.YEARLY]: 500000,
        },
        features: {
          maxListings: -1, // Unlimited
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
        } as SubscriptionFeatures,
        displayOrder: 3,
        isActive: true,
        isPublic: true,
      },
      {
        name: SubscriptionPlan.ENTERPRISE,
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
          [BillingCycle.MONTHLY]: 150000,
          [BillingCycle.QUARTERLY]: 400000,  
          [BillingCycle.YEARLY]: 1500000,    
        },
        features: {
          maxListings: -1,
          maxActiveListings: -1,
          canBoostListings: true,
          boostsPerMonth: -1, // Unlimited
          prioritySupport: true,
          analytics: true,
          apiAccess: true,
          teamMembers: -1, // Unlimited
          virtualTours: true,
          professionalPhotography: true,
          featuredListings: -1,
          socialMediaIntegration: true,
          leadGeneration: true,
          whiteLabel: true,
        } as SubscriptionFeatures,
        displayOrder: 4,
        isActive: true,
        isPublic: true,
      },
    ];
  }

  /**
   * Get all available subscription plans
   */
  async getPlans(): Promise<SubscriptionPlanModel[]> {
    return this.subscriptionPlanModel
      .find({ isActive: true, isPublic: true })
      .sort({ displayOrder: 1 })
      .exec();
  }

  /**
   * Get user's current subscription
   * Changed return type to SubscriptionDocument for proper Mongoose methods
   */
  async getUserSubscription(userId: string): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel
      .findOne({
        userId: new Types.ObjectId(userId),
        status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] },
      })
      .populate('lastPaymentTransactionId')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Activate subscription after successful payment
   */
  async activateSubscription(transactionId: string): Promise<SubscriptionDocument> {
    try {
      this.logger.log(`Activating subscription for transaction: ${transactionId}`);

      const transaction = await this.transactionModel
        .findById(transactionId)
        .exec();

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (transaction.type !== TransactionType.SUBSCRIPTION) {
        throw new BadRequestException('Transaction is not for subscription');
      }

      const planName = transaction.metadata?.planName as SubscriptionPlan;
      const billingCycle = transaction.metadata?.billingCycle as BillingCycle;

      if (!planName || !billingCycle) {
        throw new BadRequestException('Missing subscription details in transaction');
      }

      // Get plan details
      const plan = await this.subscriptionPlanModel.findOne({ name: planName });
      if (!plan) {
        throw new NotFoundException('Subscription plan not found');
      }

      // Calculate subscription dates
      const startDate = new Date();
      const endDate = this.calculateEndDate(startDate, billingCycle);
      const nextBillingDate = this.calculateNextBillingDate(endDate, billingCycle);

      // Check for existing active subscription
      const existingSubscription = await this.getUserSubscription(transaction.userId.toString());
      if (existingSubscription) {
        existingSubscription.status = SubscriptionStatus.CANCELLED;
        existingSubscription.cancelledAt = new Date();
        existingSubscription.cancellationReason = 'Upgraded to new plan';
        await existingSubscription.save();
      }

      // Create new subscription
      const subscription = new this.subscriptionModel({
        userId: transaction.userId,
        plan: planName,
        status: SubscriptionStatus.ACTIVE,
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

      // Link subscription to transaction
      transaction.subscriptionId = subscription._id as Types.ObjectId;
      await transaction.save();

      this.logger.log(`Subscription activated: ${subscription._id}`);
      return subscription;
    } catch (error) {
      this.logger.error('Activate subscription error:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    userId: string,
    cancelDto: CancelSubscriptionDto,
  ): Promise<SubscriptionDocument> {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    subscription.status = cancelDto.cancelImmediately
      ? SubscriptionStatus.CANCELLED
      : SubscriptionStatus.ACTIVE; // Keep active until end date

    subscription.autoRenew = false;
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = cancelDto.reason;

    await subscription.save();

    this.logger.log(`Subscription cancelled: ${subscription._id}`);
    return subscription;
  }

  /**
   * Check subscription usage
   */
  async checkUsageLimit(
    userId: string,
    resourceType: 'listings' | 'boosts',
  ): Promise<{ canUse: boolean; remaining: number; limit: number }> {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      // Free plan limits
      return {
        canUse: false,
        remaining: 0,
        limit: resourceType === 'listings' ? 3 : 0,
      };
    }

    const limit = resourceType === 'listings'
      ? subscription.features.maxListings
      : subscription.features.boostsPerMonth;

    // Handle undefined limit
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

  /**
   * Increment usage counter
   */
  async incrementUsage(
    userId: string,
    resourceType: 'listings' | 'boosts',
  ): Promise<void> {
    const subscription = await this.getUserSubscription(userId);

    if (subscription) {
      if (resourceType === 'listings') {
        subscription.listingsUsed += 1;
      } else if (resourceType === 'boosts') {
        subscription.boostsUsed += 1;
      }
      await subscription.save();
    }
  }

  /**
   * Cron job: Check and expire subscriptions daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkExpiredSubscriptions(): Promise<void> {
    try {
      this.logger.log('Running subscription expiration check');

      const expiredSubscriptions = await this.subscriptionModel.find({
        status: SubscriptionStatus.ACTIVE,
        endDate: { $lte: new Date() },
      });

      for (const subscription of expiredSubscriptions) {
        if (subscription.autoRenew) {
          // TODO: Attempt to renew subscription automatically
          this.logger.log(`Auto-renewal needed for subscription: ${subscription._id}`);
          // Implement auto-renewal logic here
        } else {
          subscription.status = SubscriptionStatus.EXPIRED;
          await subscription.save();
          this.logger.log(`Subscription expired: ${subscription._id}`);
        }
      }

      this.logger.log(`Processed ${expiredSubscriptions.length} expired subscriptions`);
    } catch (error) {
      this.logger.error('Error checking expired subscriptions:', error);
    }
  }

  /**
   * Reset monthly usage counters
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async resetMonthlyUsage(): Promise<void> {
    try {
      this.logger.log('Resetting monthly usage counters');

      await this.subscriptionModel.updateMany(
        { status: SubscriptionStatus.ACTIVE },
        { $set: { listingsUsed: 0, boostsUsed: 0 } },
      );

      this.logger.log('Monthly usage counters reset successfully');
    } catch (error) {
      this.logger.error('Error resetting monthly usage:', error);
    }
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

private calculateEndDate(startDate: Date, billingCycle: BillingCycle): Date {
  const endDate = new Date(startDate);

  switch (billingCycle) {
    case BillingCycle.MONTHLY:
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case BillingCycle.QUARTERLY:
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case BillingCycle.YEARLY:
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
  }

  return endDate;
}

  private calculateNextBillingDate(endDate: Date, billingCycle: BillingCycle): Date {
    return new Date(endDate);
  }
}