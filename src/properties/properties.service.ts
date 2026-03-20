import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';

import { Property, PropertyDocument, PropertyType, PropertyStatus, ApprovalStatus, ListingType, PricingUnit, CancellationPolicy } from './schemas/property.schema';
import { User, UserRole, UserDocument } from '../users/schemas/user.schema';
import { HistoryService } from '../history/history.service';
import { ActivityType } from '../history/schemas/history.schema';
import { UserInteractionsService } from '../user-interactions/user-interactions.service';
import { InteractionType, InteractionSource } from '../user-interactions/schemas/user-interaction.schema';
import { BlockDatesDto, UnblockDatesDto, CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto';

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
  isInstantBookable?: boolean;
  /** Only return properties that can accommodate this many guests */
  minGuests?: number;
  /** Filter by cancellation policy */
  cancellationPolicy?: CancellationPolicy;
  /** Filter by pricing unit (nightly / weekly / monthly) */
  pricingUnit?: PricingUnit;
  /**
   * Availability window — exclude properties with confirmed/pending bookings
   * that overlap this range. Handled in PropertiesService via a sub-query
   * against the Booking collection.
   */
  checkIn?: Date;
  checkOut?: Date;
}

export interface PropertySearchOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeInactive?: boolean;
}



@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private historyService: HistoryService,
    private userInteractionsService: UserInteractionsService,
  ) { }

  /**
 * Create a new property
 */
  async create(createPropertyDto: CreatePropertyDto, user: User): Promise<Property> {
    try {
      // Destructure coords out first to avoid spreading them alongside locationData
      const { latitude, longitude, ...restDto } = createPropertyDto;

      // Validate coordinates if provided
      if (latitude !== undefined && longitude !== undefined) {
        if (!this.isValidCoordinate(latitude, longitude)) {
          throw new BadRequestException('Invalid coordinates provided');
        }
      }

      // Build GeoJSON location only if coordinates are available
      const locationData = (latitude !== undefined && longitude !== undefined) ? {
        location: {
          type: 'Point' as const,
          coordinates: [Number(longitude), Number(latitude)] as [number, number],
        }
      } : {};

      const isAdmin = user.role === UserRole.ADMIN;

      if (createPropertyDto.listingType === ListingType.SHORT_TERM) {
        this.validateShortTermFields(createPropertyDto);
      }

      const property = new this.propertyModel({
        ...restDto,          // spread DTO WITHOUT lat/lng to avoid location conflict
        ...locationData,     // apply proper GeoJSON object
        latitude,
        longitude,
        ownerId: user._id,
        agentId: user.role === UserRole.AGENT ? user._id : undefined,
        slug: this.generateSlug(createPropertyDto.title),
        keywords: this.generateKeywords(createPropertyDto),
        approvalStatus: isAdmin ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
        isActive: isAdmin,
        pricingUnit: createPropertyDto.pricingUnit ?? PricingUnit.NIGHTLY,
        minNights: createPropertyDto.minNights ?? 1,
        maxNights: createPropertyDto.maxNights ?? 365,
        cleaningFee: createPropertyDto.cleaningFee ?? 0,
        serviceFee: createPropertyDto.serviceFee ?? 0,
        shortTermAmenities: createPropertyDto.shortTermAmenities ?? {},
        isInstantBookable: createPropertyDto.isInstantBookable ?? false,
        cancellationPolicy: createPropertyDto.cancellationPolicy ?? CancellationPolicy.FLEXIBLE,
        advanceNoticeDays: createPropertyDto.advanceNoticeDays ?? 0,
        bookingWindowDays: createPropertyDto.bookingWindowDays ?? 365,
        unavailableDates: [],
      });

      const savedProperty = await property.save();
      this.logger.log(`Property created: ${savedProperty._id} by user ${user._id} (approvalStatus: ${savedProperty.approvalStatus})`);

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
        query.approvalStatus = ApprovalStatus.APPROVED;
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
      // ── Short-term filters ──────────────────────────────────────────────────
      if (filters.isInstantBookable !== undefined) {
        query.isInstantBookable = filters.isInstantBookable;
      }

      if (filters.pricingUnit) {
        query.pricingUnit = filters.pricingUnit;
      }

      if (filters.cancellationPolicy) {
        query.cancellationPolicy = filters.cancellationPolicy;
      }

      if (filters.minGuests) {
        query['shortTermAmenities.maxGuests'] = { $gte: filters.minGuests };
      }

      // Availability window — exclude properties booked in this date range
      if (filters.checkIn && filters.checkOut) {
        const bookedPropertyIds = await this.getBookedPropertyIds(
          filters.checkIn,
          filters.checkOut,
        );
        query._id = { $nin: bookedPropertyIds };
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

        // Track search interaction for recommendations
        await this.userInteractionsService.trackInteraction({
          userId: user._id,
          interactionType: InteractionType.SEARCH,
          source: InteractionSource.SEARCH_RESULTS,
          city: filters.city,
          metadata: {
            searchQuery: JSON.stringify(filters),
            searchFilters: filters,
            resultsCount: total,
          },
          location: filters.latitude && filters.longitude ? {
            type: 'Point',
            coordinates: [filters.longitude, filters.latitude],
          } : undefined,
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

        // Track nearby search interaction for recommendations
        await this.userInteractionsService.trackInteraction({
          userId: user._id,
          interactionType: InteractionType.MAP_VIEW,
          source: InteractionSource.MAP,
          location: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          metadata: {
            searchQuery: `nearby:${latitude},${longitude},${radiusKm}km`,
            resultsCount: properties.length,
            radius: radiusKm,
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
          agentId: property.agentId ? (property.agentId as any)._id : property.ownerId,
          city: property.city,
        });

        // Update user's recently viewed properties
        await this.updateRecentlyViewed(user._id as Types.ObjectId, property._id as Types.ObjectId);

        // Track user interaction for recommendations
        await this.userInteractionsService.trackInteraction({
          userId: user._id,
          interactionType: InteractionType.PROPERTY_VIEW,
          propertyId: property._id,
          source: InteractionSource.DIRECT_LINK,
          city: property.city,
          propertyType: property.type,
          price: property.price,
          listingType: property.listingType,
          bedrooms: property.amenities?.bedrooms,
          bathrooms: property.amenities?.bathrooms,
          location: property.location
            ? {
              type: 'Point' as const,
              coordinates: property.location.coordinates,
            }
            : undefined,
          neighborhood: property.neighborhood,
        });
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
   * Admin: Get all properties (any approval status) with full filtering
   */
  async getAllPropertiesAdmin(
    filters: {
      approvalStatus?: ApprovalStatus;
      propertyType?: PropertyType;
      listingType?: ListingType;
      city?: string;
      ownerId?: string;
      search?: string;
    } = {},
    options: PropertySearchOptions = {},
  ): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filters.approvalStatus) query.approvalStatus = filters.approvalStatus;
    if (filters.propertyType) query.type = filters.propertyType;
    if (filters.listingType) query.listingType = filters.listingType;
    if (filters.city) query.city = { $regex: filters.city, $options: 'i' };
    if (filters.ownerId) query.ownerId = new Types.ObjectId(filters.ownerId);
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { city: { $regex: filters.search, $options: 'i' } },
        { address: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [properties, total] = await Promise.all([
      this.propertyModel
        .find(query)
        .populate('ownerId', 'name email phoneNumber profilePicture role agency')
        .populate('agentId', 'name email profilePicture agency')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.propertyModel.countDocuments(query),
    ]);

    return { properties, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Admin: Approve a property — makes it live
   */
  async approveProperty(id: string, admin: User): Promise<Property> {
    const property = await this.propertyModel.findById(id);
    if (!property) throw new NotFoundException('Property not found');
    if (admin.role !== UserRole.ADMIN) throw new ForbiddenException('Only admins can approve properties');

    const updated = await this.propertyModel
      .findByIdAndUpdate(
        id,
        {
          approvalStatus: ApprovalStatus.APPROVED,
          isActive: true,
          $unset: { rejectionReason: '' },
        },
        { new: true },
      )
      .populate('ownerId', 'name email phoneNumber')
      .populate('agentId', 'name email agency')
      .exec();

    this.logger.log(`Property ${id} approved by admin ${admin._id}`);
    return updated!;
  }

  /**
   * Admin: Reject a property — keeps it hidden
   */
  async rejectProperty(id: string, reason: string | undefined, admin: User): Promise<Property> {
    const property = await this.propertyModel.findById(id);
    if (!property) throw new NotFoundException('Property not found');
    if (admin.role !== UserRole.ADMIN) throw new ForbiddenException('Only admins can reject properties');

    const updated = await this.propertyModel
      .findByIdAndUpdate(
        id,
        {
          approvalStatus: ApprovalStatus.REJECTED,
          isActive: false,
          ...(reason ? { rejectionReason: reason } : {}),
        },
        { new: true },
      )
      .populate('ownerId', 'name email phoneNumber')
      .populate('agentId', 'name email agency')
      .exec();

    this.logger.log(`Property ${id} rejected by admin ${admin._id}. Reason: ${reason ?? 'none'}`);
    return updated!;
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
    property.images = [...(property.images || []), ...uploads];
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
    (property as any).videos = [...((property as any).videos || []), ...uploads];
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
   * Always ensures properties are from the same city
   */
  async getSimilarProperties(
    propertyId: string,
    limit: number = 6,
  ): Promise<Property[]> {
    try {
      // Validate propertyId format
      if (!Types.ObjectId.isValid(propertyId)) {
        this.logger.error(`Invalid property ID format: ${propertyId}`);
        throw new BadRequestException('Invalid property ID format');
      }

      // Get the reference property
      const property = await this.propertyModel.findById(propertyId);

      if (!property) {
        this.logger.error(`Property not found: ${propertyId}`);
        throw new NotFoundException('Property not found');
      }

      this.logger.log(`Finding similar properties for: ${propertyId}`);
      this.logger.log(`Reference property - type: ${property.type}, city: ${property.city}, price: ${property.price}, listingType: ${property.listingType}`);

      // Calculate price range (±30% of the property price)
      const priceMin = property.price * 0.7;
      const priceMax = property.price * 1.3;

      // Build base query - ALWAYS include same city
      const buildBaseQuery = (includePrice = true, includeType = true) => {
        const query: any = {
          _id: { $ne: property._id },
          isActive: true,
          availability: PropertyStatus.ACTIVE,
        };

        // ALWAYS filter by city (case-insensitive)
        if (property.city) {
          query.city = { $regex: new RegExp(`^${property.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
        }

        // Add listingType (rent/sale) - important for similarity
        if (property.listingType) {
          query.listingType = property.listingType;
        }

        // Optionally add type
        if (includeType && property.type) {
          query.type = property.type;
        }

        // Optionally add price range
        if (includePrice) {
          query.price = { $gte: priceMin, $lte: priceMax };
        }

        return query;
      };

      const propertyIds = new Set<string>();
      const properties: Property[] = [];

      // Helper function to add unique properties
      const addUniqueProperties = (newProperties: Property[]) => {
        for (const prop of newProperties) {
          const id = prop._id.toString();
          if (!propertyIds.has(id)) {
            propertyIds.add(id);
            properties.push(prop);
          }
        }
      };

      // Strategy 1: Try location-based search (if location exists)
      if (property.location?.coordinates &&
        Array.isArray(property.location.coordinates) &&
        property.location.coordinates.length === 2 &&
        property.location.coordinates[0] !== 0 &&
        property.location.coordinates[1] !== 0) {

        try {
          this.logger.log(`Strategy 1: Location-based search (10km radius)`);

          const locationQuery = {
            ...buildBaseQuery(true, true),
            location: {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: property.location.coordinates,
                },
                $maxDistance: 10000, // 10km radius
              },
            },
          };

          const nearbyProperties = await this.propertyModel
            .find(locationQuery)
            .populate('ownerId', 'name profilePicture')
            .populate('agentId', 'name profilePicture agency')
            .limit(limit)
            .lean()
            .exec();

          addUniqueProperties(nearbyProperties as Property[]);
          this.logger.log(`Found ${nearbyProperties.length} properties using location-based search`);
        } catch (locationError) {
          this.logger.warn(`Location search failed (geospatial index may be missing): ${locationError.message}`);
        }
      }

      // Strategy 2: Same city + same type + same listing + similar price (no location)
      if (properties.length < limit) {
        this.logger.log(`Strategy 2: Same city, type, listing type, and price range (count: ${properties.length})`);

        const remainingLimit = limit - properties.length;
        const standardProperties = await this.propertyModel
          .find(buildBaseQuery(true, true))
          .populate('ownerId', 'name profilePicture')
          .populate('agentId', 'name profilePicture agency')
          .sort({ createdAt: -1 })
          .limit(remainingLimit)
          .lean()
          .exec();

        addUniqueProperties(standardProperties as Property[]);
        this.logger.log(`Found ${standardProperties.length} additional properties`);
      }

      // Strategy 3: Same city + same type + same listing (relaxed price)
      if (properties.length < limit) {
        this.logger.log(`Strategy 3: Same city, type, listing - relaxed price (count: ${properties.length})`);

        const remainingLimit = limit - properties.length;
        const relaxedPriceProperties = await this.propertyModel
          .find(buildBaseQuery(false, true)) // No price constraint
          .populate('ownerId', 'name profilePicture')
          .populate('agentId', 'name profilePicture agency')
          .sort({ createdAt: -1 })
          .limit(remainingLimit)
          .lean()
          .exec();

        addUniqueProperties(relaxedPriceProperties as Property[]);
        this.logger.log(`Found ${relaxedPriceProperties.length} properties with relaxed price`);
      }

      // Strategy 4: Same city + same listing type (relaxed type and price)
      if (properties.length < limit) {
        this.logger.log(`Strategy 4: Same city and listing type only (count: ${properties.length})`);

        const remainingLimit = limit - properties.length;
        const fallbackProperties = await this.propertyModel
          .find(buildBaseQuery(false, false)) // No price or type constraints
          .populate('ownerId', 'name profilePicture')
          .populate('agentId', 'name profilePicture agency')
          .sort({ createdAt: -1 })
          .limit(remainingLimit)
          .lean()
          .exec();

        addUniqueProperties(fallbackProperties as Property[]);
        this.logger.log(`Found ${fallbackProperties.length} fallback properties`);
      }

      this.logger.log(`Final result: ${properties.length} similar properties for property ${propertyId}`);

      return properties.slice(0, limit);

    } catch (error) {
      this.logger.error(`Error finding similar properties for ${propertyId}:`, error);

      // For known errors, rethrow
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      // For unexpected errors, return empty array for graceful degradation
      this.logger.error('Unexpected error, returning empty array');
      return [];
    }
  }
  /**
   * Get user's favorite properties
   */
  async getUserFavorites(
    userId: string,
    options: PropertySearchOptions = {},
  ): Promise<{ properties: any[]; total: number; page: number; totalPages: number }> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      const skip = (page - 1) * limit;

      // Step 1: Get only the favorites array (IDs) from the user
      const userDoc = await this.userModel
        .findById(userId)
        .select('favorites')
        .lean()
        .exec();

      if (!userDoc) {
        throw new NotFoundException('User not found');
      }

      const favoriteIds: Types.ObjectId[] = (userDoc.favorites as any[]) || [];
      const total = favoriteIds.length;

      if (total === 0) {
        return { properties: [], total: 0, page, totalPages: 0 };
      }

      // Step 2: Query the property model directly for those IDs with proper pagination & sorting
      const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      const properties = await this.propertyModel
        .find({
          _id: { $in: favoriteIds },
          isActive: true,
        })
        .populate('ownerId', 'name email phoneNumber profilePicture')
        .populate('agentId', 'name email phoneNumber profilePicture agency')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();

      this.logger.log(`Retrieved ${properties.length} favorite properties for user ${userId} (total: ${total})`);

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

  async trackTourView(propertyId: string): Promise<void> {
    if (!Types.ObjectId.isValid(propertyId)) return;
    await this.propertyModel
      .findByIdAndUpdate(propertyId, { $inc: { tourViews: 1 } })
      .exec();
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

  // ─── D. getShortTermListings() ────────────────────────────────────────────

  /**
   * Convenience method: return only SHORT_TERM listings with relevant
   * sub-filters. This powers a dedicated "stays" browse page on the frontend.
   */
  async getShortTermListings(
    filters: {
      city?: string;
      minPrice?: number;
      maxPrice?: number;
      propertyType?: PropertyType;
      isInstantBookable?: boolean;
      minGuests?: number;
      cancellationPolicy?: CancellationPolicy;
      pricingUnit?: PricingUnit;
      checkIn?: Date;
      checkOut?: Date;
      latitude?: number;
      longitude?: number;
      radius?: number;
    } = {},
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
  ): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: any = {
      listingType: ListingType.SHORT_TERM,
      isActive: true,
      approvalStatus: ApprovalStatus.APPROVED,
      availability: PropertyStatus.ACTIVE,
    };

    if (filters.city) query.city = { $regex: filters.city, $options: 'i' };
    if (filters.propertyType) query.type = filters.propertyType;
    if (filters.pricingUnit) query.pricingUnit = filters.pricingUnit;
    if (filters.cancellationPolicy) query.cancellationPolicy = filters.cancellationPolicy;
    if (filters.isInstantBookable !== undefined) {
      query.isInstantBookable = filters.isInstantBookable;
    }
    if (filters.minGuests) {
      query['shortTermAmenities.maxGuests'] = { $gte: filters.minGuests };
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) query.price.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
    }

    // Geospatial (radius)
    if (filters.latitude && filters.longitude && filters.radius) {
      query.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: [filters.longitude, filters.latitude] },
          $maxDistance: filters.radius * 1000,
        },
      };
    }

    // Availability window
    if (filters.checkIn && filters.checkOut) {
      const bookedIds = await this.getBookedPropertyIds(filters.checkIn, filters.checkOut);
      if (bookedIds.length > 0) {
        query._id = { $nin: bookedIds };
      }
    }

    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

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

    return { properties, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── E. blockDates() ─────────────────────────────────────────────────────

  /**
   * Host adds one or more blocked date ranges to a property
   * (owner use, maintenance, etc.). Bookings that overlap any blocked range
   * are rejected at booking time.
   */
  async blockDates(
    propertyId: string,
    dto: BlockDatesDto,
    user: User,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) throw new NotFoundException('Property not found');

    this.assertCanManage(property, user);

    if (property.listingType !== ListingType.SHORT_TERM) {
      throw new BadRequestException(
        'Date blocking is only available for short-term listings',
      );
    }

    // Validate and transform each range
    const newRanges = dto.ranges.map((r) => {
      const from = new Date(r.from);
      const to = new Date(r.to);

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new BadRequestException(`Invalid date range: ${r.from} → ${r.to}`);
      }
      if (to <= from) {
        throw new BadRequestException(`"to" must be after "from" in range: ${r.from} → ${r.to}`);
      }

      return { from, to, reason: r.reason };
    });

    // Merge with existing, de-duplicate by from date
    const existingRanges: any[] = (property as any).unavailableDates ?? [];
    const existingFromSet = new Set(existingRanges.map((r: any) => r.from.toISOString()));

    const toAdd = newRanges.filter((r) => !existingFromSet.has(r.from.toISOString()));

    const updated = await this.propertyModel
      .findByIdAndUpdate(
        propertyId,
        { $push: { unavailableDates: { $each: toAdd } } },
        { new: true },
      )
      .exec();

    this.logger.log(
      `Blocked ${toAdd.length} date range(s) on property ${propertyId} by user ${user._id}`,
    );

    return updated!;
  }

  // ─── F. unblockDates() ────────────────────────────────────────────────────

  /**
   * Host removes previously blocked date ranges, identified by their `from` date.
   * Accepts an array of ISO date strings matching the `from` field of the ranges
   * to remove.
   */
  async unblockDates(
    propertyId: string,
    dto: UnblockDatesDto,
    user: User,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) throw new NotFoundException('Property not found');

    this.assertCanManage(property, user);

    // Parse and normalize the dates provided by the caller
    const fromDatesToRemove = dto.fromDates.map((d) => {
      const parsed = new Date(d);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException(`Invalid date: ${d}`);
      }
      return parsed;
    });

    // Use $pull with $in on the from field
    const updated = await this.propertyModel
      .findByIdAndUpdate(
        propertyId,
        {
          $pull: {
            unavailableDates: {
              from: { $in: fromDatesToRemove },
            },
          },
        },
        { new: true },
      )
      .exec();

    this.logger.log(
      `Unblocked ${fromDatesToRemove.length} date range(s) on property ${propertyId}`,
    );

    return updated!;
  }

  // ─── G. getBlockedDates() (convenience for the host calendar) ─────────────

  /**
   * Returns all manually blocked date ranges for a property.
   * Public — the frontend booking calendar needs this alongside booked ranges.
   */
  async getBlockedDates(
    propertyId: string,
  ): Promise<{ unavailableDates: any[] }> {
    if (!Types.ObjectId.isValid(propertyId)) {
      throw new BadRequestException('Invalid property ID');
    }

    const property = await this.propertyModel
      .findById(propertyId)
      .select('unavailableDates listingType')
      .lean()
      .exec();

    if (!property) throw new NotFoundException('Property not found');

    return { unavailableDates: (property as any).unavailableDates ?? [] };
  }

  // ─── H. getShortTermById() ────────────────────────────────────────────────

  /**
   * Returns a short-term property with its full short-term fields populated.
   * Adds a `shortTermSummary` projection not present in the standard findOne().
   */
  async getShortTermById(propertyId: string): Promise<any> {
    if (!Types.ObjectId.isValid(propertyId)) {
      throw new BadRequestException('Invalid property ID');
    }

    const property = await this.propertyModel
      .findOne({
        _id: new Types.ObjectId(propertyId),
        listingType: ListingType.SHORT_TERM,
        isActive: true,
        approvalStatus: ApprovalStatus.APPROVED,
      })
      .populate('ownerId', 'name email phoneNumber profilePicture')
      .populate('agentId', 'name email phoneNumber profilePicture agency')
      .lean()
      .exec();

    if (!property) {
      throw new NotFoundException('Short-term property not found');
    }

    // Attach a summary object consumed by the frontend booking widget
    return {
      ...property,
      shortTermSummary: {
        pricePerNight: (property as any).pricingUnit === 'nightly' ? property.price : null,
        pricingUnit: (property as any).pricingUnit,
        minNights: (property as any).minNights,
        maxNights: (property as any).maxNights,
        cleaningFee: (property as any).cleaningFee,
        isInstantBookable: (property as any).isInstantBookable,
        cancellationPolicy: (property as any).cancellationPolicy,
        checkInTime: (property as any).shortTermAmenities?.checkInTime,
        checkOutTime: (property as any).shortTermAmenities?.checkOutTime,
        maxGuests: (property as any).shortTermAmenities?.maxGuests,
        advanceNoticeDays: (property as any).advanceNoticeDays,
        bookingWindowDays: (property as any).bookingWindowDays,
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Queries the Booking collection for property IDs that have a confirmed or
   * pending booking overlapping the given window.
   *
   * NOTE: The Booking model is NOT injected here to avoid a circular dependency
   * between the Properties and Bookings modules. If you prefer a direct injection,
   * add @InjectModel(Booking.name) to the constructor and import BookingSchema
   * in PropertiesModule. The alternative (shown here) is to use a raw mongoose
   * model lookup via connection.model().
   *
   * In your actual PropertiesService, inject BookingModel directly:
   *   @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>
   */
  private async getBookedPropertyIds(
    checkIn: Date,
    checkOut: Date,
  ): Promise<Types.ObjectId[]> {
    // Dynamic model resolution to avoid circular imports
    // Replace with direct injection if preferred (see note above)
    const bookingModel = (this.propertyModel.db as any).model('Booking');

    if (!bookingModel) {
      this.logger.warn('Booking model not available — skipping availability filter');
      return [];
    }

    const bookings = await bookingModel
      .find({
        status: { $in: ['confirmed', 'pending'] },
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn },
      })
      .select('propertyId')
      .lean()
      .exec();

    return bookings.map((b: any) => b.propertyId) as Types.ObjectId[];
  }

  /**
   * Validation applied only to short-term listings on create / update.
   */
  validateShortTermFields(dto: any): void {
    if (!dto.pricingUnit) {
      throw new BadRequestException(
        'pricingUnit is required for short-term listings (nightly / weekly / monthly)',
      );
    }

    if (dto.minNights && dto.maxNights && dto.minNights > dto.maxNights) {
      throw new BadRequestException('minNights cannot be greater than maxNights');
    }

    if (
      dto.shortTermAmenities?.checkInTime &&
      !/^\d{2}:\d{2}$/.test(dto.shortTermAmenities.checkInTime)
    ) {
      throw new BadRequestException('checkInTime must be in HH:mm format');
    }

    if (
      dto.shortTermAmenities?.checkOutTime &&
      !/^\d{2}:\d{2}$/.test(dto.shortTermAmenities.checkOutTime)
    ) {
      throw new BadRequestException('checkOutTime must be in HH:mm format');
    }
  }

  /**
   * Checks that the requesting user is the property owner, assigned agent,
   * or an admin. Throws ForbiddenException otherwise.
   */
  private assertCanManage(property: Property, user: User): void {
    const isOwner = property.ownerId.toString() === user._id.toString();
    const isAgent = property.agentId?.toString() === user._id.toString();
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isOwner && !isAgent && !isAdmin) {
      throw new ForbiddenException('You can only manage your own properties');
    }
  }
}