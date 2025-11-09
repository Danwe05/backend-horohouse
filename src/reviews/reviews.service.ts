import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument, ReviewType } from './schemas/review.schema';
import { User, UserRole } from '../users/schemas/user.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { CreateReviewDto, UpdateReviewDto, RespondReviewDto } from './dto';

export interface ReviewFilters {
  reviewType?: ReviewType;
  propertyId?: string;
  agentId?: string;
  minRating?: number;
  maxRating?: number;
  verified?: boolean;
}

export interface ReviewOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private userModel: Model<any>,
  ) {}

  /**
   * Create a new review
   */
  async create(createReviewDto: CreateReviewDto, user: User): Promise<Review> {
    try {
      // Validate that either propertyId or agentId is provided
      if (createReviewDto.reviewType === ReviewType.PROPERTY && !createReviewDto.propertyId) {
        throw new BadRequestException('Property ID is required for property reviews');
      }

      if (createReviewDto.reviewType === ReviewType.AGENT && !createReviewDto.agentId) {
        throw new BadRequestException('Agent ID is required for agent reviews');
      }

      // Check if user has already reviewed this property/agent
      const existingReview = await this.checkExistingReview(
        user._id as Types.ObjectId,
        createReviewDto.propertyId,
        createReviewDto.agentId,
      );

      if (existingReview) {
        throw new BadRequestException('You have already reviewed this ' + createReviewDto.reviewType);
      }

      // For property reviews, verify property exists
      if (createReviewDto.propertyId) {
        const property = await this.propertyModel.findById(createReviewDto.propertyId);
        if (!property) {
          throw new NotFoundException('Property not found');
        }

        // Optional: Check if user has viewed/interacted with the property
        // This adds authenticity to reviews
      }

      // For agent reviews, verify agent exists
      if (createReviewDto.agentId) {
        const agent = await this.userModel.findOne({
          _id: createReviewDto.agentId,
          role: UserRole.AGENT,
          isActive: true,
        });

        if (!agent) {
          throw new NotFoundException('Agent not found');
        }
      }

      // Create review
      const review = new this.reviewModel({
        userId: user._id,
        userName: user.name,
        reviewType: createReviewDto.reviewType,
        propertyId: createReviewDto.propertyId ? new Types.ObjectId(createReviewDto.propertyId) : undefined,
        agentId: createReviewDto.agentId ? new Types.ObjectId(createReviewDto.agentId) : undefined,
        rating: createReviewDto.rating,
        comment: createReviewDto.comment,
        images: createReviewDto.images || [],
        verified: true, // Mark as verified since user is authenticated
      });

      const savedReview = await review.save();

      // Update property/agent rating
      if (createReviewDto.propertyId) {
        await this.updatePropertyRating(createReviewDto.propertyId);
      }

      if (createReviewDto.agentId) {
        await this.updateAgentRating(createReviewDto.agentId);
      }

      this.logger.log(`Review created: ${savedReview._id} by user ${user._id}`);
      return savedReview;
    } catch (error) {
      this.logger.error('Error creating review:', error);
      throw error;
    }
  }

  /**
   * Get reviews with filters and pagination
   */
  async findAll(
    filters: ReviewFilters = {},
    options: ReviewOptions = {},
  ): Promise<{
    reviews: Review[];
    total: number;
    page: number;
    totalPages: number;
    averageRating: number;
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      const skip = (page - 1) * limit;

      // Build query
      const query: any = { isActive: true };

      if (filters.reviewType) {
        query.reviewType = filters.reviewType;
      }

      if (filters.propertyId) {
        query.propertyId = new Types.ObjectId(filters.propertyId);
      }

      if (filters.agentId) {
        query.agentId = new Types.ObjectId(filters.agentId);
      }

      if (filters.minRating || filters.maxRating) {
        query.rating = {};
        if (filters.minRating) query.rating.$gte = filters.minRating;
        if (filters.maxRating) query.rating.$lte = filters.maxRating;
      }

      if (typeof filters.verified === 'boolean') {
        query.verified = filters.verified;
      }

      // Build sort
      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute queries
      const [reviews, total] = await Promise.all([
        this.reviewModel
          .find(query)
          .populate('userId', 'name profilePicture')
          .populate('respondedBy', 'name profilePicture')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.reviewModel.countDocuments(query),
      ]);

      // Calculate average rating
      const avgResult = await this.reviewModel.aggregate([
        { $match: query },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } },
      ]);

      const averageRating = avgResult.length > 0 ? Number(avgResult[0].avgRating.toFixed(1)) : 0;

      return {
        reviews,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        averageRating,
      };
    } catch (error) {
      this.logger.error('Error finding reviews:', error);
      throw error;
    }
  }

  /**
   * Get property reviews
   */
  async getPropertyReviews(
    propertyId: string,
    options: ReviewOptions = {},
  ): Promise<any> {
    return this.findAll(
      { reviewType: ReviewType.PROPERTY, propertyId },
      options,
    );
  }

  /**
   * Get agent reviews
   */
  async getAgentReviews(
    agentId: string,
    options: ReviewOptions = {},
  ): Promise<any> {
    return this.findAll(
      { reviewType: ReviewType.AGENT, agentId },
      options,
    );
  }

  /**
   * Get review statistics for property
   */
  async getPropertyReviewStats(propertyId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
  }> {
    const reviews = await this.reviewModel
      .find({
        propertyId: new Types.ObjectId(propertyId),
        isActive: true,
      })
      .select('rating')
      .exec();

    return this.calculateReviewStats(reviews);
  }

  /**
   * Get review statistics for agent
   */
  async getAgentReviewStats(agentId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
  }> {
    const reviews = await this.reviewModel
      .find({
        agentId: new Types.ObjectId(agentId),
        isActive: true,
      })
      .select('rating')
      .exec();

    return this.calculateReviewStats(reviews);
  }

  /**
   * Get single review by ID
   */
  async findOne(id: string): Promise<Review> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel
      .findById(id)
      .populate('userId', 'name profilePicture')
      .populate('propertyId', 'title images address')
      .populate('agentId', 'name profilePicture agency')
      .populate('respondedBy', 'name profilePicture')
      .exec();

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  /**
   * Update review
   */
  async update(id: string, updateReviewDto: UpdateReviewDto, user: User): Promise<Review> {
    const review = await this.reviewModel.findById(id);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check if user owns the review
    if (review.userId.toString() !== user._id.toString()) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    // Update review
    Object.assign(review, updateReviewDto);
    await review.save();

    // Update ratings
    if (updateReviewDto.rating) {
      if (review.propertyId) {
        await this.updatePropertyRating(review.propertyId.toString());
      }
      if (review.agentId) {
        await this.updateAgentRating(review.agentId.toString());
      }
    }

    this.logger.log(`Review updated: ${id} by user ${user._id}`);
    return review;
  }

  /**
   * Respond to a review (Agent/Admin only)
   */
  async respondToReview(
    id: string,
    respondReviewDto: RespondReviewDto,
    user: User,
  ): Promise<Review> {
    const review = await this.reviewModel.findById(id);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check permissions
    const canRespond =
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.AGENT && review.agentId?.toString() === user._id.toString());

    if (!canRespond) {
      throw new ForbiddenException('You can only respond to reviews about yourself');
    }

    review.response = respondReviewDto.response;
    review.respondedBy = user._id as Types.ObjectId;
    review.respondedAt = new Date();

    await review.save();

    this.logger.log(`Review response added: ${id} by user ${user._id}`);
    return review;
  }

  /**
   * Mark review as helpful
   */
  async markAsHelpful(id: string, user: User): Promise<Review> {
    const review = await this.reviewModel.findById(id);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const userId = user._id as Types.ObjectId;
    const alreadyMarked = review.helpfulBy.some(
      id => id.toString() === userId.toString(),
    );

    if (alreadyMarked) {
      // Remove from helpful
      review.helpfulBy = review.helpfulBy.filter(
        id => id.toString() !== userId.toString(),
      );
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      // Add to helpful
      review.helpfulBy.push(userId);
      review.helpfulCount += 1;
    }

    await review.save();

    this.logger.log(`Review helpful status toggled: ${id} by user ${user._id}`);
    return review;
  }

  /**
   * Delete review (soft delete)
   */
  async remove(id: string, user: User): Promise<void> {
    const review = await this.reviewModel.findById(id);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check permissions
    const canDelete =
      user.role === UserRole.ADMIN ||
      review.userId.toString() === user._id.toString();

    if (!canDelete) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    review.isActive = false;
    await review.save();

    // Update ratings
    if (review.propertyId) {
      await this.updatePropertyRating(review.propertyId.toString());
    }
    if (review.agentId) {
      await this.updateAgentRating(review.agentId.toString());
    }

    this.logger.log(`Review deleted: ${id} by user ${user._id}`);
  }

  /**
   * Get user's reviews
   */
  async getUserReviews(
    userId: string,
    options: ReviewOptions = {},
  ): Promise<any> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query = {
      userId: new Types.ObjectId(userId),
      isActive: true,
    };

    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [reviews, total] = await Promise.all([
      this.reviewModel
        .find(query)
        .populate('propertyId', 'title images address')
        .populate('agentId', 'name profilePicture agency')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.reviewModel.countDocuments(query),
    ]);

    return {
      reviews,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  private async checkExistingReview(
    userId: Types.ObjectId,
    propertyId?: string,
    agentId?: string,
  ): Promise<Review | null> {
    const query: any = {
      userId,
      isActive: true,
    };

    if (propertyId) {
      query.propertyId = new Types.ObjectId(propertyId);
    }

    if (agentId) {
      query.agentId = new Types.ObjectId(agentId);
    }

    return this.reviewModel.findOne(query).exec();
  }

  private calculateReviewStats(reviews: any[]): {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
  } {
    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews
        : 0;

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    reviews.forEach(r => {
      ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
    });

    return {
      averageRating: Number(averageRating.toFixed(1)),
      totalReviews,
      ratingDistribution,
    };
  }

  private async updatePropertyRating(propertyId: string): Promise<void> {
    try {
      const stats = await this.getPropertyReviewStats(propertyId);

      await this.propertyModel.findByIdAndUpdate(propertyId, {
        averageRating: stats.averageRating,
        reviewCount: stats.totalReviews,
      });
    } catch (error) {
      this.logger.error(`Failed to update property rating for ${propertyId}:`, error);
    }
  }

  private async updateAgentRating(agentId: string): Promise<void> {
    try {
      const stats = await this.getAgentReviewStats(agentId);

      await this.userModel.findByIdAndUpdate(agentId, {
        averageRating: stats.averageRating,
        reviewCount: stats.totalReviews,
      });
    } catch (error) {
      this.logger.error(`Failed to update agent rating for ${agentId}:`, error);
    }
  }
}