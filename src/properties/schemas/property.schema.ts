import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PropertyDocument = Property & Document;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum PropertyType {
  // Residential
  APARTMENT = 'apartment',
  HOUSE = 'house',
  VILLA = 'villa',
  STUDIO = 'studio',
  DUPLEX = 'duplex',
  BUNGALOW = 'bungalow',
  PENTHOUSE = 'penthouse',
  LAND = 'land',
  // Commercial
  COMMERCIAL = 'commercial',
  OFFICE = 'office',
  SHOP = 'shop',
  WAREHOUSE = 'warehouse',
  // ── Short-term / hospitality 
  HOTEL = 'hotel',
  MOTEL = 'motel',
  VACATION_RENTAL = 'vacation_rental',
  GUESTHOUSE = 'guesthouse',
  HOSTEL = 'hostel',
  RESORT = 'resort',
  SERVICED_APARTMENT = 'serviced_apartment',
}

export enum PropertyStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  RENTED = 'rented',
  PENDING = 'pending',
  DRAFT = 'draft',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ListingType {
  SALE = 'sale',
  RENT = 'rent',
  SHORT_TERM = 'short_term', // NEW — nightly / weekly pricing
}

export enum PricingUnit {
  NIGHTLY = 'nightly',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export enum CancellationPolicy {
  FLEXIBLE = 'flexible',   // Full refund up to 24h before check-in
  MODERATE = 'moderate',   // Full refund up to 5 days before check-in
  STRICT = 'strict',     // 50% refund up to 7 days before check-in
  NO_REFUND = 'no_refund',
}

// ─── Sub-document interfaces ──────────────────────────────────────────────────

export interface PropertyAmenities {
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  hasGarden?: boolean;
  hasPool?: boolean;
  hasGym?: boolean;
  hasSecurity?: boolean;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasAirConditioning?: boolean;
  hasInternet?: boolean;
  hasGenerator?: boolean;
  furnished?: boolean;
}

/**
 * Amenities specific to short-term / hospitality listings.
 * Kept separate from PropertyAmenities so long-term listings stay clean.
 */
export interface ShortTermAmenities {
  // Essentials
  hasWifi?: boolean;
  hasBreakfast?: boolean;      // breakfast included in price
  hasParking?: boolean;
  hasTv?: boolean;
  hasKitchen?: boolean;        // full kitchen available
  hasKitchenette?: boolean;    // small kitchenette only
  hasWasher?: boolean;
  hasDryer?: boolean;
  hasAirConditioning?: boolean;
  hasHeating?: boolean;
  // Guest policies
  petsAllowed?: boolean;
  smokingAllowed?: boolean;
  partiesAllowed?: boolean;
  maxGuests?: number;          // hard cap enforced at booking time
  // Check-in details
  checkInTime?: string;        // "14:00"
  checkOutTime?: string;       // "11:00"
  selfCheckIn?: boolean;       // keypad / lockbox
  // Accessibility
  wheelchairAccessible?: boolean;
  // Extra services
  airportTransfer?: boolean;
  conciergeService?: boolean;
  dailyHousekeeping?: boolean;
}

export interface PropertyImages {
  url: string;
  publicId: string;
  caption?: string;
  isMain?: boolean;
}

export interface PropertyMediaItem {
  url: string;
  publicId: string;
  caption?: string;
}

/** A date range blocked by the host (no bookings accepted). */
export interface UnavailableDateRange {
  from: Date;
  to: Date;
  reason?: string;   // 'owner_use' | 'maintenance' | custom string
}

// ─── Schema ───────────────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class Property {
  _id!: Types.ObjectId;

  // ── Core ─────────────────────────────────────────────────────────────────

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  price: number;  // base price — interpreted per pricingUnit for short-term

  @Prop({ default: 'XAF' })
  currency?: string;

  @Prop({ type: String, enum: Object.values(PropertyType), required: true })
  type: PropertyType;

  @Prop({ type: String, enum: Object.values(ListingType), required: true })
  listingType: ListingType;

  @Prop({ required: true })
  description: string;

  // ── Location ─────────────────────────────────────────────────────────────

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  address: string;

  @Prop()
  state?: string;

  @Prop()
  neighborhood?: string;

  @Prop()
  country?: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: undefined,
    },
  })
  location: {
    type: string;
    coordinates: [number, number];
  };

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  // ── Media ─────────────────────────────────────────────────────────────────

  @Prop({ type: [Object], default: [] })
  images: PropertyImages[];

  @Prop({ type: [Object], default: [] })
  videos: PropertyMediaItem[];

  // ── Standard amenities (long-term) ───────────────────────────────────────

  @Prop({ type: Object, default: {} })
  amenities: PropertyAmenities;

  // ── Short-term specific fields (NEW) ──────────────────────────────────────

  /**
   * Only relevant when listingType === 'short_term'.
   * Determines how `price` is interpreted.
   */
  @Prop({
    type: String,
    enum: Object.values(PricingUnit),
    default: PricingUnit.NIGHTLY,
  })
  pricingUnit: PricingUnit;

  /** Minimum number of nights per booking (e.g. 2). Default: 1. */
  @Prop({ default: 1, min: 1 })
  minNights: number;

  /** Maximum number of nights per booking (e.g. 30). Default: 365. */
  @Prop({ default: 365, min: 1 })
  maxNights: number;

  /**
   * One-time cleaning fee added on top of nightly price.
   * Stored separately so guests see the price breakdown clearly.
   */
  @Prop({ default: 0, min: 0 })
  cleaningFee: number;

  /**
   * Additional per-booking service fee (platform or host fee).
   * The BookingsService also applies a platform percentage on top of this.
   */
  @Prop({ default: 0, min: 0 })
  serviceFee: number;

  /**
   * Percentage discount applied when the guest books ≥7 nights.
   * Host-configurable.  0–100 (default 10 = 10%).
   */
  @Prop({ default: 10, min: 0, max: 100 })
  weeklyDiscountPercent: number;

  /**
   * Percentage discount applied when the guest books ≥28 nights.
   * Host-configurable.  0–100 (default 15 = 15%).
   */
  @Prop({ default: 15, min: 0, max: 100 })
  monthlyDiscountPercent: number;

  /**
   * Date ranges blocked by the host (owner use, maintenance, etc.).
   * Bookings are rejected if they overlap any of these ranges.
   */
  @Prop({
    type: [
      {
        from: { type: Date, required: true },
        to: { type: Date, required: true },
        reason: { type: String },
      },
    ],
    default: [],
  })
  unavailableDates: UnavailableDateRange[];

  /**
   * Amenities relevant only to short-term / hospitality listings
   * (wifi, breakfast, check-in time, max guests, pet policy, etc.).
   */
  @Prop({ type: Object, default: {} })
  shortTermAmenities: ShortTermAmenities;

  /**
   * If true, bookings are automatically confirmed without host approval.
   * Equivalent to Airbnb "Instant Book".
   */
  @Prop({ default: false })
  isInstantBookable: boolean;

  /**
   * Governs how much of the booking total is refunded on cancellation
   * and how far in advance the guest must cancel.
   */
  @Prop({
    type: String,
    enum: Object.values(CancellationPolicy),
    default: CancellationPolicy.FLEXIBLE,
  })
  cancellationPolicy: CancellationPolicy;

  /**
   * Optional advance notice required before a guest can check in.
   * 0 = same-day bookings allowed.
   */
  @Prop({ default: 0, min: 0 })
  advanceNoticeDays: number;

  /**
   * How far in advance guests can book (e.g. 365 = up to 1 year ahead).
   */
  @Prop({ default: 365, min: 1 })
  bookingWindowDays: number;

  // ── Owner / agent ─────────────────────────────────────────────────────────

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  agentId?: Types.ObjectId;

  // ── Details ───────────────────────────────────────────────────────────────

  @Prop()
  area?: number;

  @Prop()
  yearBuilt?: number;

  @Prop()
  floorNumber?: number;

  @Prop()
  totalFloors?: number;

  // ── Pricing extras ────────────────────────────────────────────────────────

  @Prop()
  pricePerSqm?: number;

  @Prop()
  depositAmount?: number;

  @Prop()
  maintenanceFee?: number;

  // ── Contact ───────────────────────────────────────────────────────────────

  @Prop()
  contactPhone?: string;

  @Prop()
  contactEmail?: string;

  // ── SEO ───────────────────────────────────────────────────────────────────

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop()
  slug?: string;

  @Prop({ type: [String], default: [] })
  nearbyAmenities: string[];

  @Prop({ type: [String], default: [] })
  transportAccess: string[];

  // ── Analytics ─────────────────────────────────────────────────────────────

  @Prop({ default: 0 })
  viewsCount: number;

  @Prop({ default: 0 })
  inquiriesCount: number;

  @Prop({ default: 0 })
  favoritesCount: number;

  @Prop({ default: 0 })
  sharesCount: number;

  // ── Status & approval ─────────────────────────────────────────────────────

  @Prop({ type: String, enum: Object.values(PropertyStatus), default: PropertyStatus.ACTIVE })
  availability: PropertyStatus;

  @Prop({ type: String, enum: Object.values(ApprovalStatus), default: ApprovalStatus.PENDING })
  approvalStatus: ApprovalStatus;

  @Prop()
  rejectionReason?: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: false })
  isActive: boolean;

  // ── Ratings ───────────────────────────────────────────────────────────────

  @Prop({ default: 0 })
  averageRating?: number;

  @Prop({ default: 0 })
  reviewCount?: number;

  // ── Virtual tour ─────────────────────────────────────────────────────────

  @Prop()
  virtualTourUrl?: string;

  @Prop()
  videoUrl?: string;

  // ── Timestamps ───────────────────────────────────────────────────────────

  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema factory & indexes ─────────────────────────────────────────────────

export const PropertySchema = SchemaFactory.createForClass(Property);

// Geospatial
PropertySchema.index({ location: '2dsphere' });
PropertySchema.index({ location: '2dsphere', type: 1, availability: 1 });

// Full-text search
PropertySchema.index({
  title: 'text',
  description: 'text',
  city: 'text',
  neighborhood: 'text',
  keywords: 'text',
});

// Common filter combinations
PropertySchema.index({ city: 1, type: 1, listingType: 1 });
PropertySchema.index({ price: 1, city: 1 });
PropertySchema.index({ availability: 1, isActive: 1 });
PropertySchema.index({ ownerId: 1, createdAt: -1 });
PropertySchema.index({ viewsCount: -1 });
PropertySchema.index({ createdAt: -1 });

// NEW — short-term specific queries
PropertySchema.index({ listingType: 1, isInstantBookable: 1, isActive: 1 });
PropertySchema.index({ listingType: 1, cancellationPolicy: 1 });
// Blocked-dates range queries (used by availability endpoint)
PropertySchema.index({ 'unavailableDates.from': 1, 'unavailableDates.to': 1 });