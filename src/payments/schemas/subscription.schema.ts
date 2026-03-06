import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

// Export BillingCycle enum
export enum BillingCycle {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export enum SubscriptionPlan {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  PROFESSIONAL = 'professional',
  AGENCY = 'agency',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
}

export type SubscriptionFeatures = {
  maxListings?: number;
  maxActiveListings?: number;
  canBoostListings?: boolean;
  boostsPerMonth?: number;
  prioritySupport?: boolean;
  analytics?: boolean;
  apiAccess?: boolean;
  teamMembers?: number;
  virtualTours?: boolean;
  professionalPhotography?: boolean;
  featuredListings?: number;
  socialMediaIntegration?: boolean;
  leadGeneration?: boolean;
  whiteLabel?: boolean;
  [key: string]: any;
};

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, type: String, enum: SubscriptionPlan })
  plan: SubscriptionPlan;

  @Prop({ required: true, type: String, enum: SubscriptionStatus, default: SubscriptionStatus.PENDING })
  status: SubscriptionStatus;

  @Prop({ type: String, enum: BillingCycle, required: true })
  billingCycle: BillingCycle;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 'XAF' })
  currency: string;

  @Prop({ type: Object, required: true })
  features: SubscriptionFeatures;

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop()
  nextBillingDate?: Date;

  @Prop({ default: true })
  autoRenew: boolean;

  // Usage tracking
  @Prop({ default: 0 })
  listingsUsed: number;

  @Prop({ default: 0 })
  boostsUsed: number;

  // Payment tracking
  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  lastPaymentTransactionId?: Types.ObjectId;

  @Prop()
  lastPaymentDate?: Date;

  // Cancellation details
  @Prop()
  cancelledAt?: Date;

  @Prop()
  cancellationReason?: string;

  // Upgrade/downgrade tracking
  @Prop({ type: Types.ObjectId, ref: 'Subscription' })
  previousSubscriptionId?: Types.ObjectId;

  @Prop({ type: String, enum: SubscriptionPlan })
  upgradedFrom?: SubscriptionPlan;

  @Prop()
  providerSubscriptionId?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

// Indexes
SubscriptionSchema.index({ userId: 1 });
SubscriptionSchema.index({ plan: 1, status: 1 });
SubscriptionSchema.index({ status: 1, endDate: 1 }); // For expiration checks