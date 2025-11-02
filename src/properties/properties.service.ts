import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';

import { Property, PropertyDocument, PropertyType, PropertyStatus, ListingType } from './schemas/property.schema';
import { User, UserRole, UserDocument } from '../users/schemas/user.schema';
import { HistoryService } from '../history/history.service';
import { ActivityType } from '../history/schemas/history.schema';

export interface PropertySearchFilters {
  minPrice?: number;
  maxPrice?: number;
  propertyType?: PropertyType;
  listingType?: ListingType;
  city?: string;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  // Geospatial filters
  latitude?: number;
  longitude?: number;
  radius?: number; // in kilometers
  bounds?: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
}

export interface PropertySearchOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeInactive?: boolean;
}

export interface CreatePropertyDto {
  title: string;
  price: number;
  currency?: string;
  type: PropertyType;
  listingType: ListingType;
  description: string;
  city: string;
  address: string;
  state: string;
  neighborhood?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  amenities?: {
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
  };
  images?: any[];
  videos?: any[];
  contactPhone?: string;
  contactEmail?: string;
  area?: number;
  yearBuilt?: number;
  floorNumber?: number;
  totalFloors?: number;
  pricePerSqm?: number;
  depositAmount?: number;
  maintenanceFee?: number;
  keywords?: string[];
  nearbyAmenities?: string[];
  transportAccess?: string[];
  virtualTourUrl?: string;
  videoUrl?: string;
  status?: PropertyStatus;
}

export interface UpdatePropertyDto extends Partial<CreatePropertyDto> {
  availability?: PropertyStatus;
  isVerified?: boolean;
  isFeatured?: boolean;
  isActive?: boolean;
}

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private historyService: HistoryService,
  ) {}

  /**
 * Create a new property
 */
async create(createPropertyDto: CreatePropertyDto, user: User): Promise<Property> {
  try {
    let latitude = createPropertyDto.latitude;
    let longitude = createPropertyDto.longitude;

    // Validate coordinates if they are provided
    if (latitude !== undefined && longitude !== undefined) {
      if (!this.isValidCoordinate(latitude, longitude)) {
        throw new BadRequestException('Invalid coordinates provided');
      }
    }

    // Create location object only if coordinates are available
    const locationData = (latitude !== undefined && longitude !== undefined) ? {
      location: {
        type: 'Point' as const,
        coordinates: [longitude, latitude],
      }
    } : {};

    const property = new this.propertyModel({
      ...createPropertyDto,
      ...locationData,
      latitude,
      longitude,
      ownerId: user._id,
      agentId: user.role === UserRole.AGENT ? user._id : undefined,
      slug: this.generateSlug(createPropertyDto.title),
      keywords: this.generateKeywords(createPropertyDto),
    });

    const savedProperty = await property.save();
    this.logger.log(`Property created: ${savedProperty._id} by user ${user._id}`);

    return savedProperty;
  } catch (error) {
    this.logger.error('Error creating property:', error);
    throw error;
  }
}

  /**
   * Find properties with advanced filtering and geospatial search
   */
  async findAll(
    filters: PropertySearchFilters = {},
    options: PropertySearchOptions = {},
    user?: User,
  ): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeInactive = false,
      } = options;

      const skip = (page - 1) * limit;

      // Build query
      const query: any = {};

      // Basic filters
      if (!includeInactive) {
        query.isActive = true;
        query.availability = PropertyStatus.ACTIVE;
      }

      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        query.price = {};
        if (filters.minPrice !== undefined) query.price.$gte = filters.minPrice;
        if (filters.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
      }

      if (filters.propertyType) {
        query.type = filters.propertyType;
      }

      if (filters.listingType) {
        query.listingType = filters.listingType;
      }

      if (filters.city) {
        query.city = { $regex: filters.city, $options: 'i' };
      }

      if (filters.bedrooms) {
        query['amenities.bedrooms'] = { $gte: filters.bedrooms };
      }

      if (filters.bathrooms) {
        query['amenities.bathrooms'] = { $gte: filters.bathrooms };
      }

      if (filters.amenities && filters.amenities.length > 0) {
        const amenityQueries = filters.amenities.map(amenity => ({
          [`amenities.${amenity}`]: true,
        }));
        query.$and = amenityQueries;
      }

      // Geospatial queries
      if (filters.latitude && filters.longitude) {
        if (filters.radius) {
          // Search within radius
          query.location = {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [filters.longitude, filters.latitude],
              },
              $maxDistance: filters.radius * 1000, // Convert km to meters
            },
          };
        }
      }

      // Bounding box search
      if (filters.bounds) {
        const { northeast, southwest } = filters.bounds;
        query.location = {
          $geoWithin: {
            $box: [
              [southwest.lng, southwest.lat],
              [northeast.lng, northeast.lat],
            ],
          },
        };
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute queries
      const [properties, total] = await Promise.all([
        this.propertyModel
          .find(query)
          .populate('ownerId', 'name email phoneNumber profilePicture')
          .populate('agentId', 'name email phoneNumber profilePicture agency')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.propertyModel.countDocuments(query),
      ]);

      // Log search for analytics if user is provided
      if (user) {
        await this.historyService.logActivity({
          userId: user._id,
          activityType: ActivityType.SEARCH,
          searchQuery: JSON.stringify(filters),
          searchFilters: filters,
          resultsCount: total,
          userLocation: filters.latitude && filters.longitude ? {
            type: 'Point',
            coordinates: [filters.longitude, filters.latitude],
          } : undefined,
          city: filters.city,
        });
      }

      return {
        properties,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Error finding properties:', error);
      throw error;
    }
  }

  /**
   * Find properties near a location
   */
  async findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
    limit: number = 10,
    user?: User,
  ): Promise<Property[]> {
    try {
      if (!this.isValidCoordinate(latitude, longitude)) {
        throw new BadRequestException('Invalid coordinates provided');
      }

      const properties = await this.propertyModel
        .find({
          location: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [longitude, latitude],
              },
              $maxDistance: radiusKm * 1000,
            },
          },
          isActive: true,
          availability: PropertyStatus.ACTIVE,
        })
        .populate('ownerId', 'name email phoneNumber')
        .populate('agentId', 'name email phoneNumber agency')
        .limit(limit)
        .exec();

      // Log search for analytics
      if (user) {
        await this.historyService.logActivity({
          userId: user._id,
          activityType: ActivityType.SEARCH,
          searchQuery: `nearby:${latitude},${longitude},${radiusKm}km`,
          resultsCount: properties.length,
          userLocation: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
        });
      }

      return properties;
    } catch (error) {
      this.logger.error('Error finding nearby properties:', error);
      throw error;
    }
  }

  /**
   * Get property by ID and increment view count
   */
  async findOne(id: string, user?: User): Promise<Property> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        this.logger.error(`Invalid property ID received: ${id}`);
        throw new BadRequestException(`Invalid property ID format: ${id}. Expected 24-character hexadecimal string.`);
      }

      const property = await this.propertyModel
        .findById(id)
        .populate('ownerId', 'name email phoneNumber profilePicture')
        .populate('agentId', 'name email phoneNumber profilePicture agency licenseNumber')
        .exec();

      if (!property) {
        throw new NotFoundException('Property not found');
      }

      // Increment view count
      await this.propertyModel.findByIdAndUpdate(id, { $inc: { viewsCount: 1 } });

      // Log property view for analytics and recommendations
      if (user) {
        await this.historyService.logActivity({
          userId: user._id,
          activityType: ActivityType.PROPERTY_VIEW,
          propertyId: property._id as Types.ObjectId,
          city: property.city,
        });

        // Update user's recently viewed properties
        await this.updateRecentlyViewed(user._id as Types.ObjectId, property._id as Types.ObjectId);
      }

      return property;
    } catch (error) {
      this.logger.error(`Error finding property ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update property
   */
async update(id: string, updatePropertyDto: UpdatePropertyDto, user: User): Promise<Property> {
  try {
    const property = await this.propertyModel.findById(id);

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Check permissions
    if (
      user.role !== UserRole.ADMIN &&
      property.ownerId.toString() !== user._id.toString() &&
      property.agentId?.toString() !== user._id.toString()
    ) {
      throw new ForbiddenException('You can only update your own properties');
    }

    // Update location if coordinates are provided
    if (updatePropertyDto.latitude !== undefined && updatePropertyDto.longitude !== undefined) {
      if (!this.isValidCoordinate(updatePropertyDto.latitude, updatePropertyDto.longitude)) {
        throw new BadRequestException('Invalid coordinates provided');
      }

      updatePropertyDto['location'] = {
        type: 'Point' as const,
        coordinates: [updatePropertyDto.longitude, updatePropertyDto.latitude],
      };
    }

    // Update keywords if title or description changed
    if (updatePropertyDto.title || updatePropertyDto.description) {
      updatePropertyDto.keywords = this.generateKeywords({
        title: updatePropertyDto.title || property.title,
        description: updatePropertyDto.description || property.description,
        city: updatePropertyDto.city || property.city,
        type: updatePropertyDto.type || property.type,
      } as any);
    }

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, updatePropertyDto, { new: true })
      .populate('ownerId', 'name email phoneNumber')
      .populate('agentId', 'name email phoneNumber agency')
      .exec();

    if (!updatedProperty) {
      throw new NotFoundException('Property not found after update');
    }

    this.logger.log(`Property updated: ${id} by user ${user._id}`);
    return updatedProperty;
  } catch (error) {
    this.logger.error(`Error updating property ${id}:`, error);
    throw error;
  }
}


  /**
   * Delete property
   */
  async remove(id: string, user: User): Promise<void> {
    try {
      const property = await this.propertyModel.findById(id);

      if (!property) {
        throw new NotFoundException('Property not found');
      }

      // Check permissions
      if (
        user.role !== UserRole.ADMIN &&
        property.ownerId.toString() !== user._id.toString()
      ) {
        throw new ForbiddenException('You can only delete your own properties');
      }

      await this.propertyModel.findByIdAndDelete(id);
      this.logger.log(`Property deleted: ${id} by user ${user._id}`);
    } catch (error) {
      this.logger.error(`Error deleting property ${id}:`, error);
      throw error;
    }
  }

  /**
   * Upload images to Cloudinary and attach to property
   */
  async uploadImages(
    propertyId: string,
    files: { buffer: Buffer; filename?: string }[],
    user: User,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (
      user.role !== UserRole.ADMIN &&
      property.ownerId.toString() !== user._id.toString() &&
      property.agentId?.toString() !== user._id.toString()
    ) {
      throw new ForbiddenException('You can only modify your own properties');
    }

    const uploads = await Promise.all(
      files.map(async (file, index) => {
        const publicId = `property_${propertyId}_${Date.now()}_${index}`;
        const result = await uploadBufferToCloudinary(file.buffer, {
          publicId,
          folder: 'horohouse/properties/images',
          resourceType: 'image',
          transformation: [
            { quality: 'auto', fetch_format: 'auto' },
          ],
        });
        return { url: result.secure_url, publicId: result.public_id };
      })
    );

    // Append new uploads
    // @ts-ignore schema defines images as array of objects
    property.images = [ ...(property.images || []), ...uploads ];
    await property.save();
    return property;
  }

  /**
   * Delete an image from Cloudinary and remove from property
   */
  async deleteImage(
    propertyId: string,
    imagePublicId: string,
    user: User,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (
      user.role !== UserRole.ADMIN &&
      property.ownerId.toString() !== user._id.toString() &&
      property.agentId?.toString() !== user._id.toString()
    ) {
      throw new ForbiddenException('You can only modify your own properties');
    }

    await deleteFromCloudinary(imagePublicId, 'image');
    // @ts-ignore
    property.images = (property.images || []).filter((img: any) => img.publicId !== imagePublicId);
    await property.save();
    return property;
  }

  /**
   * Upload videos to Cloudinary and attach to property
   */
  async uploadVideos(
    propertyId: string,
    files: { buffer: Buffer; filename?: string }[],
    user: User,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (
      user.role !== UserRole.ADMIN &&
      property.ownerId.toString() !== user._id.toString() &&
      property.agentId?.toString() !== user._id.toString()
    ) {
      throw new ForbiddenException('You can only modify your own properties');
    }

    const uploads = await Promise.all(
      files.map(async (file, index) => {
        const publicId = `property_${propertyId}_video_${Date.now()}_${index}`;
        const result = await uploadBufferToCloudinary(file.buffer, {
          publicId,
          folder: 'horohouse/properties/videos',
          resourceType: 'video',
          transformation: [
            { quality: 'auto' },
          ],
        });
        return { url: result.secure_url, publicId: result.public_id };
      })
    );

    // @ts-ignore videos added on schema
    (property as any).videos = [ ...((property as any).videos || []), ...uploads ];
    await property.save();
    return property;
  }

  /**
   * Delete a video from Cloudinary and remove from property
   */
  async deleteVideo(
    propertyId: string,
    videoPublicId: string,
    user: User,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (
      user.role !== UserRole.ADMIN &&
      property.ownerId.toString() !== user._id.toString() &&
      property.agentId?.toString() !== user._id.toString()
    ) {
      throw new ForbiddenException('You can only modify your own properties');
    }

    await deleteFromCloudinary(videoPublicId, 'video');
    // @ts-ignore
    (property as any).videos = ((property as any).videos || []).filter((vid: any) => vid.publicId !== videoPublicId);
    await property.save();
    return property;
  }

  /**
   * Get most viewed properties
   */
  async getMostViewed(limit: number = 10): Promise<Property[]> {
    return this.propertyModel
      .find({ isActive: true, availability: PropertyStatus.ACTIVE })
      .sort({ viewsCount: -1 })
      .limit(limit)
      .populate('ownerId', 'name profilePicture')
      .populate('agentId', 'name profilePicture agency')
      .exec();
  }

  /**
   * Get recently added properties
   */
  async getRecent(limit: number = 10): Promise<Property[]> {
    return this.propertyModel
      .find({ isActive: true, availability: PropertyStatus.ACTIVE })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('ownerId', 'name profilePicture')
      .populate('agentId', 'name profilePicture agency')
      .exec();
  }

/**
 * Get similar properties based on property type, city, and price range
 */
async getSimilarProperties(
  propertyId: string,
  limit: number = 6,
): Promise<Property[]> {
  try {
    // Get the reference property
    const property = await this.propertyModel.findById(propertyId);
    
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Calculate price range (±30% of the property price)
    const priceMin = property.price * 0.7;
    const priceMax = property.price * 1.3;

    // Build query for similar properties
    const query: any = {
      _id: { $ne: property._id }, // Exclude the current property
      isActive: true,
      availability: PropertyStatus.ACTIVE,
      type: property.type, // Same property type
      listingType: property.listingType, // Same listing type (rent/sale)
      city: property.city, // Same city
      price: { $gte: priceMin, $lte: priceMax }, // Similar price range
    };

    // If property has location, prioritize nearby properties
    let properties: Property[];
    
    if (property.location && property.location.coordinates) {
      // Find nearby properties first
      properties = await this.propertyModel
        .find({
          ...query,
          location: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: property.location.coordinates,
              },
              $maxDistance: 10000, // 10km radius
            },
          },
        })
        .populate('ownerId', 'name profilePicture')
        .populate('agentId', 'name profilePicture agency')
        .limit(limit)
        .exec();
      
      // If not enough nearby properties, get more from the same city
      if (properties.length < limit) {
        const additionalProperties = await this.propertyModel
          .find(query)
          .populate('ownerId', 'name profilePicture')
          .populate('agentId', 'name profilePicture agency')
          .sort({ createdAt: -1 })
          .limit(limit - properties.length)
          .exec();
        
        properties = [...properties, ...additionalProperties];
      }
    } else {
      // No location data, just get similar properties from same city
      properties = await this.propertyModel
        .find(query)
        .populate('ownerId', 'name profilePicture')
        .populate('agentId', 'name profilePicture agency')
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();
    }

    this.logger.log(`Found ${properties.length} similar properties for property ${propertyId}`);
    return properties;
  } catch (error) {
    this.logger.error(`Error finding similar properties for ${propertyId}:`, error);
    throw error;
  }
}

/**
 * Get user's favorite properties
 */
async getUserFavorites(
  userId: string,
  options: PropertySearchOptions = {},
): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }> {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const skip = (page - 1) * limit;

    // Get user with populated favorites
    const user = await this.userModel
      .findById(userId)
      .populate({
        path: 'favorites',
        match: { isActive: true }, // Only get active properties
        populate: [
          { path: 'ownerId', select: 'name email phoneNumber profilePicture' },
          { path: 'agentId', select: 'name email phoneNumber profilePicture agency' }
        ],
        options: {
          sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
          skip,
          limit,
        }
      })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get total count of favorites
    const totalFavorites = await this.userModel
      .findById(userId)
      .select('favorites')
      .exec();
    
    const total = totalFavorites?.favorites?.length || 0;

    const properties = (user.favorites as any[]) || [];

    this.logger.log(`Retrieved ${properties.length} favorite properties for user ${userId}`);

    return {
      properties,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    this.logger.error(`Error getting user favorites for ${userId}:`, error);
    throw error;
  }
}

/**
 * Get properties owned by a specific user
 */
async getMyProperties(
  filters: PropertySearchFilters = {},
  options: PropertySearchOptions = {},
  userId: string,
  user?: User,
): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }> {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeInactive = true, // For user's own properties, include inactive ones
    } = options;

    const skip = (page - 1) * limit;

    // Convert string userId to ObjectId for proper querying
    const userObjectId = new Types.ObjectId(userId);

    // Build query with user's properties filter
    const query: any = {
      ownerId: userObjectId, // Use ObjectId instead of string
    };

    // Only include active filter if specifically requested (for my properties, show all by default)
    if (!includeInactive) {
      query.isActive = true;
      query.availability = PropertyStatus.ACTIVE;
    }

    // Apply additional filters
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) query.price.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
    }

    if (filters.propertyType) {
      query.type = filters.propertyType;
    }

    if (filters.listingType) {
      query.listingType = filters.listingType;
    }

    if (filters.city) {
      query.city = { $regex: filters.city, $options: 'i' };
    }

    if (filters.bedrooms) {
      query['amenities.bedrooms'] = { $gte: filters.bedrooms };
    }

    if (filters.bathrooms) {
      query['amenities.bathrooms'] = { $gte: filters.bathrooms };
    }

    if (filters.amenities && filters.amenities.length > 0) {
      const amenityQueries = filters.amenities.map(amenity => ({
        [`amenities.${amenity}`]: true,
      }));
      query.$and = amenityQueries;
    }

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Log the query for debugging
    this.logger.log(`Querying properties with: ${JSON.stringify(query)}`);

    // Execute queries
    const [properties, total] = await Promise.all([
      this.propertyModel
        .find(query)
        .populate('ownerId', 'name email phoneNumber profilePicture')
        .populate('agentId', 'name email phoneNumber profilePicture agency')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.propertyModel.countDocuments(query),
    ]);

    this.logger.log(`Retrieved ${properties.length} properties for user ${userId}, total: ${total}`);

    return {
      properties,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    this.logger.error(`Error getting user properties for ${userId}:`, error);
    throw error;
  }
}

  /**
   * Get featured properties
   */
  async getFeatured(limit: number = 10): Promise<Property[]> {
    return this.propertyModel
      .find({ isActive: true, isFeatured: true, availability: PropertyStatus.ACTIVE })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('ownerId', 'name profilePicture')
      .populate('agentId', 'name profilePicture agency')
      .exec();
  }

  /**
   * Get popular cities with property counts
   */
  async getPopularCities(limit: number = 10): Promise<Array<{ city: string; count: number }>> {
    return this.propertyModel.aggregate([
      { $match: { isActive: true, availability: PropertyStatus.ACTIVE } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, city: '$_id', count: 1 } },
    ]);
  }

  /**
   * Geocode address using Nominatim API
   */
  async geocodeAddress(address: string, city?: string, country?: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const query = [address, city, country]
  .filter(value => value && value.trim())
  .join(', ');
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        limit: 1,
      },
      headers: {
        'User-Agent': 'HoroHouse-Backend/1.0',
      },
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
      };
    }

    // Return null instead of throwing an exception
    this.logger.warn(`Geocoding failed for address: ${query}`);
    return null;
  } catch (error) {
    this.logger.error('Geocoding failed:', error);
    // Return null instead of throwing an exception
    return null;
  }
}

  /**
   * Search properties by text
   */
  async searchByText(
    searchText: string,
    filters: PropertySearchFilters = {},
    options: PropertySearchOptions = {},
    user?: User,
  ) {
    try {
      const query: any = {
        $text: { $search: searchText },
        isActive: true,
        availability: PropertyStatus.ACTIVE,
        ...this.buildFilterQuery(filters),
      };

      const { page = 1, limit = 20, sortBy = 'score' } = options;
      const skip = (page - 1) * limit;

      let sort: any = {};
      if (sortBy === 'score') {
        sort = { score: { $meta: 'textScore' } };
      } else {
        sort[sortBy] = options.sortOrder === 'asc' ? 1 : -1;
      }

      const [properties, total] = await Promise.all([
        this.propertyModel
          .find(query, { score: { $meta: 'textScore' } })
          .populate('ownerId', 'name profilePicture')
          .populate('agentId', 'name profilePicture agency')
          .sort(sort)
          .skip(skip)
          .limit(limit),
        this.propertyModel.countDocuments(query),
      ]);

      // Log search
      if (user) {
        await this.historyService.logActivity({
          userId: user._id,
          activityType: ActivityType.SEARCH,
          searchQuery: searchText,
          searchFilters: filters,
          resultsCount: total,
        });
      }

      return {
        properties,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Text search failed:', error);
      throw error;
    }
  }

  // Helper methods
  private isValidCoordinate(latitude: number, longitude: number): boolean {
    return (
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

private generateKeywords(property: any): string[] {
  const keywords: string[] = [];  // typed properly
  
  if (property.title) {
    keywords.push(...property.title.toLowerCase().split(' '));
  }
  if (property.description) {
    keywords.push(...property.description.toLowerCase().split(' '));
  }
  if (property.city) {
    keywords.push(property.city.toLowerCase());
  }
  if (property.type) {
    keywords.push(property.type.toString().toLowerCase());
  }

  return [...new Set(keywords)].filter(keyword => keyword.length > 2);
}

  private buildFilterQuery(filters: PropertySearchFilters): any {
    const query: any = {};

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) query.price.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
    }

    if (filters.propertyType) query.type = filters.propertyType;
    if (filters.listingType) query.listingType = filters.listingType;
    if (filters.city) query.city = { $regex: filters.city, $options: 'i' };
    if (filters.bedrooms) query['amenities.bedrooms'] = { $gte: filters.bedrooms };
    if (filters.bathrooms) query['amenities.bathrooms'] = { $gte: filters.bathrooms };

    return query;
  }

private async updateRecentlyViewed(userId: Types.ObjectId, propertyId: Types.ObjectId): Promise<void> {
  try {
    this.logger.log(`Updating recently viewed for user ${userId}, property ${propertyId}`);
    
    // First remove any existing entry for this property
    await this.userModel.updateOne(
      { _id: userId },
      { $pull: { recentlyViewed: { propertyId: propertyId } } }
    );

    // Then push the new entry at the top of the array
    const result = await this.userModel.updateOne(
      { _id: userId },
      {
        $push: {
          recentlyViewed: {
            $each: [{ propertyId: propertyId, viewedAt: new Date() }],
            $position: 0,
            $slice: 50, // Keep only the last 50 viewed
          },
        },
      }
    );

    this.logger.log(`Recently viewed updated: ${result.modifiedCount} document(s) modified`);
  } catch (error) {
    this.logger.error('Failed to update recently viewed:', error);
  }
}
}