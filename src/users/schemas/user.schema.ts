import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  /** Platform administrator — full access across long-term and short-term modules. */
  ADMIN = 'admin',
  /** Real-estate agent — can list and manage both long-term and short-term properties on behalf of owners. */
  AGENT = 'agent',
  /** Property owner managing long-term rentals (leases, tenants, rental income). */
  LANDLORD = 'landlord',
  /** Default role for any registered user browsing or inquiring on listings. */
  REGISTERED_USER = 'registered_user',
  /** User who books short-term stays (hotels, vacation rentals, featured houses). */
  GUEST = 'guest',
  /** University student — access to student housing search, roommate matching, and student-verified listings. */
  STUDENT = 'student',
}

// ─── Student verification status ─────────────────────────────────────────────

export enum StudentVerificationStatus {
  /** Student has not yet submitted their ID */
  UNVERIFIED = 'unverified',
  /** ID uploaded, awaiting manual or automated review */
  PENDING = 'pending',
  /** ID confirmed — student gains access to roommate pool and verified listings */
  VERIFIED = 'verified',
  /** ID was rejected (expired, wrong doc type, unreadable) */
  REJECTED = 'rejected',
}

// ─── Student profile subdocument ──────────────────────────────────────────────

export interface StudentProfile {
  /** Full name of the university as it appears on the student ID */
  universityName: string;
  /** e.g. "Faculty of Engineering and Technology" */
  faculty?: string;
  /** e.g. "L1", "L2", "L3", "Master 1", "Master 2", "PhD" */
  studyLevel?: string;
  /** Year they enrolled, e.g. 2023 */
  enrollmentYear?: number;
  /** Cloudinary URL of their university ID photo */
  studentIdUrl?: string;
  /** Cloudinary public_id for the uploaded ID (needed for deletion) */
  studentIdPublicId?: string;
  /** Human-readable verification state */
  verificationStatus: StudentVerificationStatus;
  /** Date the ID was submitted for verification */
  verificationSubmittedAt?: Date;
  /** Date the ID was approved or rejected */
  verificationReviewedAt?: Date;
  /** Admin note on rejection reason, shown to the student */
  verificationRejectionReason?: string;
  /** City of their campus — drives default property search location */
  campusCity: string;
  /** Specific campus or university gate coordinates for commute calculations */
  campusLatitude?: number;
  campusLongitude?: number;
  /** ObjectId linking to their active RoommateProfile document (if created) */
  roommateProfileId?: Types.ObjectId;
  /** Unique referral/ambassador code if the student is a campus ambassador */
  ambassadorCode?: string;
  /** Whether this student is an active campus ambassador */
  isAmbassador: boolean;
  /** Total commissions earned as ambassador (in XAF) */
  ambassadorEarnings?: number;
}

// ─── Existing interfaces (unchanged) ─────────────────────────────────────────

export type TenantStatus = 'active' | 'ended' | 'pending';

export interface TenantRecord {
  _id?: Types.ObjectId;
  tenantName: string;
  tenantEmail?: string;
  tenantPhone?: string;
  tenantUserId?: Types.ObjectId;
  propertyId: Types.ObjectId;
  leaseStart: Date;
  leaseEnd: Date;
  monthlyRent: number;
  depositAmount?: number;
  status: TenantStatus;
  notes?: string;
}

export interface UserPreferences {
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  propertyTypes?: string[];
  cities?: string[];
  amenities?: string[];
  bedrooms?: number[];
  bathrooms?: number[];
  maxRadius?: number;
  minArea?: number;
  maxArea?: number;
  preferredLocation?: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface AgentPreferences {
  licenseNumber?: string;
  agency?: string;
  experience?: number;
  specializations?: string[];
  serviceAreas?: string[];
  commissionRate?: number;
  propertyPriceRange?: {
    min: number;
    max: number;
    currency: string;
  };
}

export interface SearchQuery {
  query: string;
  filters: any;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  timestamp: Date;
  resultsCount: number;
}

export interface UserSession {
  id: string;
  refreshToken: string;
  device: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  isActive: boolean;
  lastActive: Date;
  createdAt: Date;
  expiresAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

@Schema({
  timestamps: true,
  autoIndex: true,
})
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  email?: string;

  @Prop({ required: true, unique: true })
  phoneNumber: string;

  @Prop({ type: String, enum: Object.values(UserRole), default: UserRole.REGISTERED_USER })
  role: UserRole;

  @Prop({ default: null })
  profilePicture?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Property' }], default: [] })
  favorites: Types.ObjectId[];

  @Prop({ type: Object, default: {} })
  preferences: UserPreferences;

  @Prop({ type: [Object], default: [] })
  searchHistory: SearchQuery[];

  @Prop({
    type: [
      {
        propertyId: { type: Types.ObjectId, ref: 'Property' },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  recentlyViewed: Array<{
    propertyId: Types.ObjectId;
    viewedAt: Date;
  }>;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [String], default: [] })
  specialties?: string[];

  @Prop({ type: [String], default: ['English'] })
  languages?: string[];

  @Prop({ type: [String], default: [] })
  serviceAreas?: string[];

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ default: false })
  phoneVerified: boolean;

  @Prop({ unique: true, sparse: true })
  googleId?: string;

  @Prop()
  password?: string;

  @Prop({ default: 0 })
  averageRating?: number;

  @Prop({ default: 0 })
  reviewCount?: number;

  @Prop()
  phoneVerificationCode?: string;

  @Prop()
  phoneVerificationExpires?: Date;

  @Prop()
  emailVerificationToken?: string;

  @Prop()
  emailVerificationExpires?: Date;

  @Prop()
  resetPasswordToken?: string;

  @Prop()
  resetPasswordExpires?: Date;

  @Prop({ default: false })
  twoFactorEnabled?: boolean;

  @Prop()
  twoFactorSecret?: string;

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        refreshToken: { type: String, required: true },
        device: { type: String, required: true },
        ipAddress: { type: String, required: true },
        userAgent: { type: String, required: true },
        location: { type: String },
        isActive: { type: Boolean, default: true },
        lastActive: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
      },
    ],
    default: [],
  })
  sessions: UserSession[];

  // ── Agent-specific fields ─────────────────────────────────────────────────

  @Prop()
  licenseNumber?: string;

  @Prop()
  agency?: string;

  @Prop()
  bio?: string;

  @Prop()
  website?: string;

  @Prop({ default: 0 })
  propertiesListed?: number;

  @Prop({ default: 0 })
  propertiesSold?: number;

  // ── Landlord-specific fields ──────────────────────────────────────────────

  @Prop({
    type: [
      {
        _id: { type: Types.ObjectId, default: () => new Types.ObjectId() },
        tenantName: { type: String, required: true },
        tenantEmail: { type: String },
        tenantPhone: { type: String },
        tenantUserId: { type: Types.ObjectId, ref: 'User' },
        propertyId: { type: Types.ObjectId, ref: 'Property', required: true },
        leaseStart: { type: Date, required: true },
        leaseEnd: { type: Date, required: true },
        monthlyRent: { type: Number, required: true },
        depositAmount: { type: Number },
        status: { type: String, enum: ['active', 'ended', 'pending'], default: 'active' },
        notes: { type: String },
      },
    ],
    default: [],
  })
  tenants: TenantRecord[];

  @Prop({ default: 0 })
  totalRentalIncome?: number;

  @Prop({ default: 0 })
  occupancyRate?: number;

  // ── Student-specific fields (NEW) ─────────────────────────────────────────

  /**
   * Only populated when role === UserRole.STUDENT.
   * Follows the same pattern as agentPreferences.
   */
  @Prop({
    type: {
      universityName: { type: String },
      faculty: { type: String },
      studyLevel: { type: String },
      enrollmentYear: { type: Number },
      studentIdUrl: { type: String },
      studentIdPublicId: { type: String },
      verificationStatus: {
        type: String,
        enum: Object.values(StudentVerificationStatus),
        default: StudentVerificationStatus.UNVERIFIED,
      },
      verificationSubmittedAt: { type: Date },
      verificationReviewedAt: { type: Date },
      verificationRejectionReason: { type: String },
      campusCity: { type: String },
      campusLatitude: { type: Number },
      campusLongitude: { type: Number },
      roommateProfileId: { type: Types.ObjectId, ref: 'RoommateProfile' },
      ambassadorCode: { type: String },
      isAmbassador: { type: Boolean, default: false },
      ambassadorEarnings: { type: Number, default: 0 },
    },
    default: null,
  })
  studentProfile?: StudentProfile;

  // ── Notification preferences ──────────────────────────────────────────────

  @Prop({ default: true })
  emailNotifications: boolean;

  @Prop({ default: true })
  smsNotifications: boolean;

  @Prop({ default: true })
  pushNotifications: boolean;

  // ── Location ─────────────────────────────────────────────────────────────

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  })
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };

  @Prop()
  address?: string;

  @Prop()
  city?: string;

  @Prop()
  country?: string;

  // ── Onboarding ────────────────────────────────────────────────────────────

  @Prop({ default: false })
  onboardingCompleted?: boolean;

  @Prop({ type: Object, default: null })
  agentPreferences?: AgentPreferences;

  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

// ─── Schema factory & indexes ─────────────────────────────────────────────────

export const UserSchema = SchemaFactory.createForClass(User);

// Geospatial
UserSchema.index({ location: '2dsphere' });
UserSchema.index({ 'preferences.preferredLocation': '2dsphere' });

// Existing indexes
UserSchema.index({ 'recentlyViewed.propertyId': 1 });
UserSchema.index({ 'sessions.id': 1 });
UserSchema.index({ 'sessions.refreshToken': 1 });
UserSchema.index({ 'sessions.expiresAt': 1 });
UserSchema.index({ 'sessions.isActive': 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ city: 1 });
UserSchema.index({ country: 1 });
UserSchema.index({ isActive: 1 });

// Student-specific indexes (NEW)
// Fast lookup for admin verification queue
UserSchema.index({ 'studentProfile.verificationStatus': 1 });
// Fast lookup for ambassador code redemption
UserSchema.index({ 'studentProfile.ambassadorCode': 1 }, { sparse: true });
// Fast lookup for roommate profile linking
UserSchema.index({ 'studentProfile.roommateProfileId': 1 }, { sparse: true });
// Filter students by campus city for roommate matching
UserSchema.index({ role: 1, 'studentProfile.campusCity': 1 });

// Virtual id getter
UserSchema.virtual('id').get(function (this: UserDocument) {
  return this._id.toString();
});

// JSON transformation — hide sensitive fields
UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: any) => {
    delete ret._id;
    delete ret.password;
    delete ret.phoneVerificationCode;
    delete ret.emailVerificationToken;
    delete ret.resetPasswordToken;
    // Strip student ID Cloudinary public_id from API responses
    if (ret.studentProfile?.studentIdPublicId) {
      delete ret.studentProfile.studentIdPublicId;
    }
    // Strip refresh tokens from sessions
    if (ret.sessions && Array.isArray(ret.sessions)) {
      ret.sessions = ret.sessions.map((session: any) => {
        const { refreshToken, ...sessionWithoutToken } = session;
        return sessionWithoutToken;
      });
    }
    return ret;
  },
});