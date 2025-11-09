import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  ADMIN = 'admin',
  AGENT = 'agent',
  REGISTERED_USER = 'registered_user',
  GUEST = 'guest',
}

export interface UserPreferences {
  minPrice?: number;
  maxPrice?: number;
  propertyTypes?: string[];
  cities?: string[];
  amenities?: string[];
  maxRadius?: number; // in kilometers
  preferredLocation?: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
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

@Schema({
  timestamps: true,
  autoIndex: true, // Enable automatic index creation (disable in production for performance)
})
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  email?: string;

  @Prop({ required: true, unique: true })
  phoneNumber: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.REGISTERED_USER })
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
  password?: string; // For email/password auth

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

  // Two-factor authentication
  @Prop({ default: false })
  twoFactorEnabled?: boolean;

  @Prop()
  twoFactorSecret?: string;

  // Sessions tracking
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

  // Agent-specific fields
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

  // Notification preferences
  @Prop({ default: true })
  emailNotifications: boolean;

  @Prop({ default: true })
  smsNotifications: boolean;

  @Prop({ default: true })
  pushNotifications: boolean;

  // Geo location for agents (office location)
  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [lng, lat]
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

  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Define indexes explicitly after schema creation
UserSchema.index({ location: '2dsphere' });
// Note: Indexes for phoneNumber, email, and googleId are already created via
// @Prop({ unique: true, ... }) above. Avoid redefining them to prevent
// duplicate index warnings from Mongoose.

// Add indexes on nested fields
UserSchema.index({ 'preferences.preferredLocation': '2dsphere' });
UserSchema.index({ 'recentlyViewed.propertyId': 1 });

// Session-related indexes
UserSchema.index({ 'sessions.id': 1 });
UserSchema.index({ 'sessions.refreshToken': 1 });
UserSchema.index({ 'sessions.expiresAt': 1 });
UserSchema.index({ 'sessions.isActive': 1 });

// Optional indexes you may want to add:
UserSchema.index({ role: 1 });
UserSchema.index({ city: 1 });
UserSchema.index({ country: 1 });
UserSchema.index({ isActive: 1 });

// Virtual id getter
UserSchema.virtual('id').get(function (this: UserDocument) {
  return this._id.toString();
});

// JSON transformation (hide sensitive fields)
UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: any) => {
    delete ret._id;
    delete ret.password;
    delete ret.phoneVerificationCode;
    delete ret.emailVerificationToken;
    delete ret.resetPasswordToken;
    // Hide refresh tokens from sessions in JSON response
    if (ret.sessions && Array.isArray(ret.sessions)) {
      ret.sessions = ret.sessions.map((session: any) => {
        const { refreshToken, ...sessionWithoutToken } = session;
        return sessionWithoutToken;
      });
    }
    return ret;
  },
});