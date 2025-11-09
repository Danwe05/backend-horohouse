import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import { User, UserDocument, UserRole, UserPreferences } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto, UpdatePreferencesDto } from './dto';
import { Property, PropertyDocument, PropertyImages, PropertyStatus } from 'src/properties/schemas/property.schema';
import { ReviewsService } from 'src/reviews/reviews.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    private configService: ConfigService,
    private reviewsService: ReviewsService,
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
 * Get agent by ID with full details
 */
  async getAgentById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid agent ID');
    }

    const agent = await this.userModel
      .findOne({ _id: id, role: UserRole.AGENT, isActive: true })
      .select('-password -sessions -searchHistory')
      .exec();

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Get real property stats from database
    const stats = await this.getAgentPropertyStats(id);

    return {
      id: agent._id.toString(),
      name: agent.name,
      email: agent.email,
      phoneNumber: agent.phoneNumber,
      profilePicture: agent.profilePicture,
      agency: agent.agency,
      bio: agent.bio,
      city: agent.city,
      country: agent.country,
      address: agent.address,
      location: agent.location,
      totalProperties: stats.totalProperties,
      activeProperties: stats.activeProperties,
      propertiesSold: stats.propertiesSold,
      propertiesListed: stats.totalProperties,
      licenseNumber: agent.licenseNumber,
      yearsOfExperience: this.calculateYearsOfExperience(agent.createdAt),
      specialties: this.getAgentSpecialties(agent, stats),
      languages: agent.languages || ['English', 'French'], // Default if not set
      serviceAreas: this.getAgentServiceAreas(agent, stats.cities),
      createdAt: agent.createdAt,
    };
  }

  /**
   * Get agent statistics from real data
   */
  async getAgentStats(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid agent ID');
    }

    const agent = await this.userModel
      .findOne({ _id: id, role: UserRole.AGENT, isActive: true })
      .exec();

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const stats = await this.getAgentPropertyStats(id);

    // Calculate average rating from reviews (when review system is implemented)
    // For now using a calculated rating based on performance
    const reviewStats = await this.getAgentReviewStats(id);

    return {
      rating: reviewStats.averageRating,
      reviewCount: reviewStats.totalReviews,
      propertiesSold: stats.propertiesSold,
      experience: this.calculateYearsOfExperience(agent.createdAt),
      successRate: this.calculateSuccessRate(stats),
      awards: this.calculateAwards(stats),
    };
  }

  /**
   * Get agent properties with real database queries
   */
  async getAgentProperties(
    agentId: string,
    options: {
      status?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<any> {
    if (!Types.ObjectId.isValid(agentId)) {
      throw new BadRequestException('Invalid agent ID');
    }

    const agent = await this.userModel
      .findOne({ _id: agentId, role: UserRole.AGENT, isActive: true })
      .exec();

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const { status, page = 1, limit = 100 } = options;
    const skip = (page - 1) * limit;

    // Build query to find properties where user is agent or owner
    const query: any = {
      $or: [
        { agentId: new Types.ObjectId(agentId) },
        { ownerId: new Types.ObjectId(agentId) },
      ],
      isActive: true,
    };

    // Map frontend status to backend availability
    if (status) {
      const statusMap: { [key: string]: PropertyStatus } = {
        'For Sale': PropertyStatus.ACTIVE,
        'For Rent': PropertyStatus.ACTIVE,
        'Pending': PropertyStatus.PENDING,
        'Sold': PropertyStatus.SOLD,
      };

      if (status === 'For Sale' || status === 'For Rent') {
        query.availability = PropertyStatus.ACTIVE;
        // No additional filter - will show both
      } else if (statusMap[status]) {
        query.availability = statusMap[status];
      }
    }

    const [properties, total] = await Promise.all([
      this.propertyModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('ownerId', 'name email phoneNumber profilePicture')
        .populate('agentId', 'name email phoneNumber profilePicture agency')
        .exec(),
      this.propertyModel.countDocuments(query),
    ]);

    // Map properties to frontend format
    const mappedProperties = properties.map(p => {
      const prop = p.toObject(); // Convert to plain object
      return {
        id: (p._id as Types.ObjectId).toString(),
        images: (prop.images || []).map((img: PropertyImages) => img.url),
        price: prop.price,
        address: prop.address,
        city: prop.city,
        state: prop.country,
        bedrooms: prop.amenities?.bedrooms || 0,
        bathrooms: prop.amenities?.bathrooms || 0,
        squareFeet: prop.area || 0,
        status: this.mapAvailabilityToStatus(prop.availability, prop.listingType),
        propertyType: this.capitalizePropertyType(prop.type),
        soldDate: prop.availability === PropertyStatus.SOLD ? p.updatedAt.toISOString() : undefined,
        listingType: prop.listingType,
        latitude: prop.location?.coordinates?.[1] || prop.latitude,
        longitude: prop.location?.coordinates?.[0] || prop.longitude,
      };
    });

    this.logger.log(`Retrieved ${mappedProperties.length} properties for agent ${agentId}`);

    return {
      properties: mappedProperties,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get agent reviews - Real implementation
   * NOTE: You'll need to create a Review schema. For now, returning empty array.
   * Uncomment the real implementation once Review model is created.
   */
  /**
 * Get agent reviews - Real implementation
 */
  async getAgentReviews(
    agentId: string,
    options: {
      page?: number;
      limit?: number;
    } = {},
  ): Promise<any> {
    if (!Types.ObjectId.isValid(agentId)) {
      throw new BadRequestException('Invalid agent ID');
    }

    const agent = await this.userModel
      .findOne({ _id: agentId, role: UserRole.AGENT, isActive: true })
      .exec();

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // This will now work with the Review model
    // Import ReviewsService and inject it in the constructor
    const { page = 1, limit = 20 } = options;

    return this.reviewsService.getAgentReviews(agentId, { page, limit });
  }

  /**
   * Get review statistics (real implementation)
   */
  private async getAgentReviewStats(agentId: string): Promise<{
    averageRating: number;
    totalReviews: number;
  }> {
    // Use the ReviewsService instead of placeholder
    const stats = await this.reviewsService.getAgentReviewStats(agentId);

    return {
      averageRating: stats.averageRating,
      totalReviews: stats.totalReviews,
    };
  }
  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Get agent property statistics from real database
   */
  private async getAgentPropertyStats(agentId: string): Promise<{
    totalProperties: number;
    activeProperties: number;
    propertiesSold: number;
    cities: string[];
  }> {
    const agentObjectId = new Types.ObjectId(agentId);

    const stats = await this.propertyModel.aggregate([
      {
        $match: {
          $or: [
            { agentId: agentObjectId },
            { ownerId: agentObjectId },
          ],
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,
          totalProperties: { $sum: 1 },
          activeProperties: {
            $sum: {
              $cond: [
                { $eq: ['$availability', PropertyStatus.ACTIVE] },
                1,
                0,
              ],
            },
          },
          propertiesSold: {
            $sum: {
              $cond: [
                { $eq: ['$availability', PropertyStatus.SOLD] },
                1,
                0,
              ],
            },
          },
          cities: { $addToSet: '$city' },
        },
      },
    ]);

    if (!stats || stats.length === 0) {
      return {
        totalProperties: 0,
        activeProperties: 0,
        propertiesSold: 0,
        cities: [],
      };
    }

    return {
      totalProperties: stats[0].totalProperties || 0,
      activeProperties: stats[0].activeProperties || 0,
      propertiesSold: stats[0].propertiesSold || 0,
      cities: stats[0].cities || [],
    };
  }

  /**
   * Get review statistics (placeholder until Review model is created)
   */


  /**
   * Calculate years of experience based on account creation
   */
  private calculateYearsOfExperience(createdAt: Date): number {
    const years = Math.floor((Date.now() - createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return Math.max(years, 1); // Minimum 1 year for display purposes
  }

  /**
   * Calculate success rate from property stats
   */
  private calculateSuccessRate(stats: { totalProperties: number; propertiesSold: number }): number {
    if (stats.totalProperties === 0) return 95; // Default for new agents
    const rate = (stats.propertiesSold / stats.totalProperties) * 100;
    return Math.min(Math.round(rate), 100);
  }

  /**
   * Calculate awards based on performance metrics
   */
  private calculateAwards(stats: { propertiesSold: number; totalProperties: number }): number {
    let awards = 0;

    // Awards for properties sold
    if (stats.propertiesSold >= 10) awards += 2;
    if (stats.propertiesSold >= 50) awards += 3;
    if (stats.propertiesSold >= 100) awards += 5;
    if (stats.propertiesSold >= 200) awards += 5;

    // Awards for total listings
    if (stats.totalProperties >= 20) awards += 2;
    if (stats.totalProperties >= 50) awards += 3;

    return awards;
  }

  /**
   * Get agent specialties based on their property portfolio
   */
  private getAgentSpecialties(agent: any, stats: any): string[] {
    const specialties: string[] = [];

    // Use stored specialties if available
    if (agent.specialties && agent.specialties.length > 0) {
      return agent.specialties;
    }

    // Otherwise, generate based on performance
    if (stats.propertiesSold > 100) {
      specialties.push('Luxury Homes');
    }

    if (stats.totalProperties > 50) {
      specialties.push('Investment Properties');
    }

    if (stats.propertiesSold < 20 && stats.activeProperties > 5) {
      specialties.push('First-Time Buyers');
    }

    // Default specialty if none match
    if (specialties.length === 0) {
      specialties.push('Residential Properties');
    }

    return specialties;
  }

  /**
   * Get agent service areas from their property locations
   */
  private getAgentServiceAreas(agent: any, cities: string[]): string[] {
    // Use stored service areas if available
    if (agent.serviceAreas && agent.serviceAreas.length > 0) {
      return agent.serviceAreas;
    }

    // Otherwise, use cities where they have properties
    if (cities && cities.length > 0) {
      return cities.slice(0, 5); // Top 5 cities
    }

    // Fallback to agent's city
    if (agent.city) {
      return [agent.city];
    }

    return ['Downtown']; // Default
  }

  /**
   * Map backend availability status to frontend display status
   */
  private mapAvailabilityToStatus(availability: PropertyStatus, listingType: string): string {
    switch (availability) {
      case PropertyStatus.ACTIVE:
        return listingType === 'rent' ? 'For Rent' : 'For Sale';
      case PropertyStatus.SOLD:
        return 'Sold';
      case PropertyStatus.RENTED:
        return 'Rented';
      case PropertyStatus.PENDING:
        return 'Pending';
      default:
        return 'For Sale';
    }
  }

  /**
   * Capitalize property type for display
   */
  private capitalizePropertyType(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
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