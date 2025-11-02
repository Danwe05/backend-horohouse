import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import { User, UserDocument, UserRole, UserPreferences } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto, UpdatePreferencesDto } from './dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const createdUser = new this.userModel(createUserDto);
      await createdUser.save();
      
      this.logger.log(`✅ User created: ${createdUser._id}`);
      return createdUser;
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new BadRequestException(`${field} already exists`);
      }
      throw error;
    }
  }

  /**
   * Find all users with pagination and filters
   */
  async findAll(
    page = 1,
    limit = 10,
    role?: UserRole,
    isActive?: boolean,
    search?: string,
  ): Promise<{
    users: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (role) filter.role = role;
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-firebaseUid -searchHistory')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find user by ID
   */
  async findOne(id: string): Promise<User> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userModel
      .findById(id)
      .select('-firebaseUid')
      .populate('favorites', 'title images pricing address')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Find user by Firebase UID
   */
  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.userModel.findOne({ firebaseUid }).exec();
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  /**
   * Find user by phone number
   */
  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.userModel.findOne({ phoneNumber }).exec();
  }

  /**
   * Update user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .select('-firebaseUid')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`✅ User updated: ${id}`);
    return user;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(id: string, preferences: UpdatePreferencesDto): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { $set: { preferences } },
        { new: true }
      )
      .select('-firebaseUid')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(userId: string, file: { buffer: Buffer }): Promise<User> {
    try {
      // Upload image buffer to Cloudinary
      const result = await cloudinary.uploader.upload_stream(
        {
          folder: 'horohouse/profiles',
          transformation: [
            { width: 300, height: 300, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        async (error, result) => {
          if (error) {
            this.logger.error('Cloudinary upload error:', error);
            throw new BadRequestException('Failed to upload profile picture');
          }
          return result;
        },
      );

      // Because upload_stream is callback-based, we wrap it in a Promise:
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'horohouse/profiles',
            transformation: [
              { width: 300, height: 300, crop: 'fill', gravity: 'face' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );

        // Push the buffer to the uploadStream
        uploadStream.end(file.buffer);
      });

      // Update user profile picture URL
      const user = await this.userModel
        .findByIdAndUpdate(userId, { profilePicture: uploadResult.secure_url }, { new: true })
        .select('-firebaseUid')
        .exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      this.logger.log(`✅ Profile picture updated for user: ${userId}`);
      return user;
    } catch (error) {
      this.logger.error('Failed to upload profile picture:', error.message || error);
      throw new BadRequestException('Failed to upload profile picture');
    }
  }


  /**
   * Add property to favorites
   */
  async addToFavorites(userId: string, propertyId: string): Promise<User> {
    if (!Types.ObjectId.isValid(propertyId)) {
      throw new BadRequestException('Invalid property ID');
    }

    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $addToSet: { favorites: new Types.ObjectId(propertyId) } },
        { new: true }
      )
      .select('-firebaseUid')
      .populate('favorites', 'title images pricing address')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Remove property from favorites
   */
  async removeFromFavorites(userId: string, propertyId: string): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $pull: { favorites: new Types.ObjectId(propertyId) } },
        { new: true }
      )
      .select('-firebaseUid')
      .populate('favorites', 'title images pricing address')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Add to recently viewed properties
   */
  async addToRecentlyViewed(userId: string, propertyId: string): Promise<void> {
    if (!Types.ObjectId.isValid(propertyId)) {
      throw new BadRequestException('Invalid property ID');
    }

    await this.userModel.updateOne(
      { _id: userId },
      {
        $pull: { recentlyViewed: { propertyId: new Types.ObjectId(propertyId) } },
      }
    );

    await this.userModel.updateOne(
      { _id: userId },
      {
        $push: {
          recentlyViewed: {
            $each: [{ propertyId: new Types.ObjectId(propertyId), viewedAt: new Date() }],
            $position: 0,
            $slice: 50, // Keep only last 50 viewed properties
          },
        },
      }
    );
  }

  /**
   * Get recently viewed properties
   */
  async getRecentlyViewed(userId: string, limit = 10): Promise<any[]> {
    const user = await this.userModel
      .findById(userId)
      .populate({
        path: 'recentlyViewed.propertyId',
        select: 'title images pricing address type status',
        options: { limit },
      })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.recentlyViewed
      .slice(0, limit)
      .filter(item => item.propertyId) // Filter out deleted properties
      .map(item => ({
        property: item.propertyId,
        viewedAt: item.viewedAt,
      }));
  }

  /**
 * Get viewed properties with pagination and full details
 */
async getViewedPropertiesWithPagination(
  userId: string,
  options: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {},
): Promise<{
  properties: any[];
  total: number;
  page: number;
  totalPages: number;
  lastViewed?: Date;
}> {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'viewedAt',
      sortOrder = 'desc',
    } = options;

    const skip = (page - 1) * limit;

    const user = await this.userModel
      .findById(userId)
      .select('recentlyViewed')
      .populate({
        path: 'recentlyViewed.propertyId',
        match: { isActive: true },
        populate: [
          { path: 'ownerId', select: 'name email phoneNumber profilePicture' },
          { path: 'agentId', select: 'name email phoneNumber profilePicture agency' }
        ],
      })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const validViewedProperties = user.recentlyViewed.filter(
      (item: any) => item.propertyId !== null
    );

    const sortedProperties = [...validViewedProperties].sort((a: any, b: any) => {
      if (sortBy === 'viewedAt') {
        return sortOrder === 'asc'
          ? new Date(a.viewedAt).getTime() - new Date(b.viewedAt).getTime()
          : new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime();
      }
      return 0;
    });

    const paginatedProperties = sortedProperties.slice(skip, skip + limit);

    const properties = paginatedProperties.map((item: any) => ({
      ...item.propertyId.toObject(),
      viewedAt: item.viewedAt,
    }));

    const total = validViewedProperties.length;
    const lastViewed = validViewedProperties.length > 0 
      ? validViewedProperties[0].viewedAt 
      : undefined;

    this.logger.log(`Retrieved ${properties.length} viewed properties for user ${userId}`);

    return {
      properties,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      lastViewed,
    };
  } catch (error) {
    this.logger.error(`Error getting viewed properties for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Clear user's viewing history
 */
async clearViewingHistory(userId: string): Promise<{ message: string }> {
  try {
    await this.userModel.findByIdAndUpdate(userId, {
      recentlyViewed: [],
    });

    this.logger.log(`Cleared viewing history for user ${userId}`);

    return { message: 'Viewing history cleared successfully' };
  } catch (error) {
    this.logger.error(`Error clearing viewing history for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Remove specific property from viewing history
 */
async removeFromViewingHistory(
  userId: string,
  propertyId: string,
): Promise<{ message: string }> {
  try {
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { recentlyViewed: { propertyId: new Types.ObjectId(propertyId) } },
    });

    this.logger.log(`Removed property ${propertyId} from viewing history for user ${userId}`);

    return { message: 'Property removed from viewing history' };
  } catch (error) {
    this.logger.error(`Error removing property from viewing history:`, error);
    throw error;
  }
}

  /**
   * Add search to history
   */
  async addSearchToHistory(userId: string, searchData: any): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        $push: {
          searchHistory: {
            $each: [searchData],
            $position: 0,
            $slice: 100, // Keep only last 100 searches
          },
        },
      }
    );
  }

  /**
   * Get search history
   */
  async getSearchHistory(userId: string, limit = 20): Promise<any[]> {
    const user = await this.userModel
      .findById(userId)
      .select('searchHistory')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.searchHistory.slice(0, limit);
  }

  /**
   * Delete user (soft delete)
   */
  async remove(id: string): Promise<void> {
    const result = await this.userModel.updateOne(
      { _id: id },
      { isActive: false }
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`✅ User deactivated: ${id}`);
  }

  /**
   * Get user statistics
   */
  async getStats(): Promise<any> {
    const [
      totalUsers,
      activeUsers,
      agentUsers,
      verifiedUsers,
      recentUsers,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ isActive: true }),
      this.userModel.countDocuments({ role: UserRole.AGENT }),
      this.userModel.countDocuments({ 
        $or: [{ emailVerified: true }, { phoneVerified: true }] 
      }),
      this.userModel.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }),
    ]);

    const roleStats = await this.userModel.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    return {
      total: totalUsers,
      active: activeUsers,
      agents: agentUsers,
      verified: verifiedUsers,
      recent: recentUsers,
      byRole: roleStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
    };
  }

  /**
   * Get agents with their stats
   */
  async getAgents(page = 1, limit = 10): Promise<any> {
    const skip = (page - 1) * limit;

    const agents = await this.userModel.aggregate([
      { $match: { role: UserRole.AGENT, isActive: true } },
      {
        $lookup: {
          from: 'properties',
          localField: '_id',
          foreignField: 'agent',
          as: 'properties',
        },
      },
      {
        $addFields: {
          totalProperties: { $size: '$properties' },
          activeProperties: {
            $size: {
              $filter: {
                input: '$properties',
                cond: { $eq: ['$$this.status', 'available'] },
              },
            },
          },
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          phoneNumber: 1,
          profilePicture: 1,
          agency: 1,
          bio: 1,
          location: 1,
          address: 1,
          city: 1,
          totalProperties: 1,
          activeProperties: 1,
          propertiesListed: 1,
          propertiesSold: 1,
          createdAt: 1,
        },
      },
      { $sort: { totalProperties: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const total = await this.userModel.countDocuments({ 
      role: UserRole.AGENT, 
      isActive: true 
    });

    return {
      agents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update onboarding preferences for a user
   */
  async updateOnboardingPreferences(userId: string, preferences: {
    propertyPreferences?: any;
    agentPreferences?: any;
    onboardingCompleted?: boolean;
  }): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const updateData: any = {};

    if (preferences.propertyPreferences) {
      updateData.propertyPreferences = preferences.propertyPreferences;
    }

    if (preferences.agentPreferences) {
      updateData.agentPreferences = preferences.agentPreferences;
    }

    if (preferences.onboardingCompleted !== undefined) {
      updateData.onboardingCompleted = preferences.onboardingCompleted;
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`✅ Onboarding preferences updated for user: ${userId}`);
    return updatedUser;
  }
}