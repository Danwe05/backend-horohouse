import { Document, Types } from 'mongoose';
export type SubscriptionDocument = Subscription & Document;
export declare enum BillingCycle {
    MONTHLY = "monthly",
    QUARTERLY = "quarterly",
    YEARLY = "yearly"
}
export declare enum SubscriptionPlan {
    FREE = "free",
    BASIC = "basic",
    PREMIUM = "premium",
    PROFESSIONAL = "professional",
    AGENCY = "agency",
    ENTERPRISE = "enterprise"
}
export declare enum SubscriptionStatus {
    PENDING = "pending",
    ACTIVE = "active",
    EXPIRED = "expired",
    CANCELLED = "cancelled",
    SUSPENDED = "suspended"
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
export declare class Subscription {
    userId: Types.ObjectId;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    price: number;
    currency: string;
    features: SubscriptionFeatures;
    startDate?: Date;
    endDate?: Date;
    nextBillingDate?: Date;
    autoRenew: boolean;
    listingsUsed: number;
    boostsUsed: number;
    lastPaymentTransactionId?: Types.ObjectId;
    lastPaymentDate?: Date;
    cancelledAt?: Date;
    cancellationReason?: string;
    previousSubscriptionId?: Types.ObjectId;
    upgradedFrom?: SubscriptionPlan;
    providerSubscriptionId?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SubscriptionSchema: import("mongoose").Schema<Subscription, import("mongoose").Model<Subscription, any, any, any, Document<unknown, any, Subscription, any, {}> & Subscription & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Subscription, Document<unknown, {}, import("mongoose").FlatRecord<Subscription>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<Subscription> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
