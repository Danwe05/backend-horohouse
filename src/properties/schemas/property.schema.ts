import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PropertyDocument = Property & Document;

export enum PropertyType {
  APARTMENT = 'apartment',
  HOUSE = 'house',
  VILLA = 'villa',
  STUDIO = 'studio',
  DUPLEX = 'duplex',
  BUNGALOW = 'bungalow',
  PENTHOUSE = 'penthouse',
  LAND = 'land',
  COMMERCIAL = 'commercial',
  OFFICE = 'office',
  SHOP = 'shop',
  WAREHOUSE = 'warehouse',
}

export enum PropertyStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  RENTED = 'rented',
  PENDING = 'pending',
  DRAFT = 'draft',
}

export enum ListingType {
  SALE = 'sale',
  RENT = 'rent',
}

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

@Schema({ timestamps: true })
export class Property {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  price: number;

  @Prop({ type: String, enum: PropertyType, required: true })
  type: PropertyType;

  @Prop({ type: String, enum: ListingType, required: true })
  listingType: ListingType;

  @Prop({ type: [Object], default: [] })
  images: PropertyImages[];

  @Prop({ type: [Object], default: [] })
  videos: PropertyMediaItem[];

  @Prop({ required: true })
  description: string;

  @Prop({ type: Object, default: {} })
  amenities: PropertyAmenities;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  address: string;

  @Prop()
  neighborhood?: string;

  @Prop()
  country: string;

  // Geospatial field for map searches
  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  })
  location: {
    type: 'Point';
    coordinates: [number, number];
  };

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop({ default: 0 })
  viewsCount: number;

  @Prop({ type: String, enum: PropertyStatus, default: PropertyStatus.ACTIVE })
  availability: PropertyStatus;

  // Property owner/agent information
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  agentId?: Types.ObjectId;

  // Property details
  @Prop()
  area?: number; // in square meters

  @Prop()
  yearBuilt?: number;

  @Prop()
  floorNumber?: number;

  @Prop()
  totalFloors?: number;

  // Pricing details
  @Prop()
  pricePerSqm?: number;

  @Prop()
  depositAmount?: number; // for rentals

  @Prop()
  maintenanceFee?: number; // monthly maintenance

  // Contact information
  @Prop()
  contactPhone?: string;

  @Prop()
  contactEmail?: string;

  // SEO and search optimization
  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop()
  slug?: string;

  // Features for recommendations
  @Prop({ type: [String], default: [] })
  nearbyAmenities: string[]; // schools, hospitals, malls, etc.

  @Prop({ type: [String], default: [] })
  transportAccess: string[]; // bus stops, metro, highways

  // Analytics
  @Prop({ default: 0 })
  inquiriesCount: number;

  @Prop({ default: 0 })
  favoritesCount: number;

  @Prop({ default: 0 })
  sharesCount: number;

  // Property verification
  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: true })
  isActive: boolean;

  // Virtual tour links
  @Prop()
  virtualTourUrl?: string;

  @Prop()
  videoUrl?: string;

  // Timestamps are automatically added
  createdAt: Date;
  updatedAt: Date;
}

export const PropertySchema = SchemaFactory.createForClass(Property);

// Create geospatial index for location-based queries
PropertySchema.index({ location: '2dsphere' });

// Text index for search functionality
PropertySchema.index({
  title: 'text',
  description: 'text',
  city: 'text',
  neighborhood: 'text',
  keywords: 'text',
});

// Compound indexes for common queries
PropertySchema.index({ city: 1, type: 1, listingType: 1 });
PropertySchema.index({ price: 1, city: 1 });
PropertySchema.index({ availability: 1, isActive: 1 });
PropertySchema.index({ ownerId: 1, createdAt: -1 });
PropertySchema.index({ viewsCount: -1 }); // For most viewed properties
PropertySchema.index({ createdAt: -1 }); // For recent properties

// Compound geospatial and other field indexes
PropertySchema.index({ location: '2dsphere', type: 1, availability: 1 });