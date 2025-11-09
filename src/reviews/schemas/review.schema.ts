import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReviewDocument = Review & Document;

export enum ReviewType {
  PROPERTY = 'property',
  AGENT = 'agent',
}

@Schema({ timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  userName: string;

  @Prop({ type: String, enum: ReviewType, required: true })
  reviewType: ReviewType;

  // For property reviews
  @Prop({ type: Types.ObjectId, ref: 'Property' })
  propertyId?: Types.ObjectId;

  // For agent reviews
  @Prop({ type: Types.ObjectId, ref: 'User' })
  agentId?: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true, minlength: 10, maxlength: 1000 })
  comment: string;

  @Prop({ default: false })
  verified: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  respondedBy?: Types.ObjectId; // Agent can respond to reviews

  @Prop()
  response?: string;

  @Prop()
  respondedAt?: Date;

  @Prop({ type: [String], default: [] })
  images?: string[]; // Review images (optional)

  @Prop({ default: 0 })
  helpfulCount: number; // Users can mark reviews as helpful

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  helpfulBy: Types.ObjectId[]; // Track who marked as helpful

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Indexes for better query performance
ReviewSchema.index({ propertyId: 1, isActive: 1 });
ReviewSchema.index({ agentId: 1, isActive: 1 });
ReviewSchema.index({ userId: 1 });
ReviewSchema.index({ rating: 1 });
ReviewSchema.index({ createdAt: -1 });

// Compound index for property reviews
ReviewSchema.index({ propertyId: 1, rating: -1, createdAt: -1 });
// Compound index for agent reviews
ReviewSchema.index({ agentId: 1, rating: -1, createdAt: -1 });