"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PropertiesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertiesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const axios_1 = require("axios");
const cloudinary_1 = require("../utils/cloudinary");
const property_schema_1 = require("./schemas/property.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const history_service_1 = require("../history/history.service");
const history_schema_1 = require("../history/schemas/history.schema");
const user_interactions_service_1 = require("../user-interactions/user-interactions.service");
const user_interaction_schema_1 = require("../user-interactions/schemas/user-interaction.schema");
let PropertiesService = PropertiesService_1 = class PropertiesService {
    propertyModel;
    userModel;
    historyService;
    userInteractionsService;
    logger = new common_1.Logger(PropertiesService_1.name);
    constructor(propertyModel, userModel, historyService, userInteractionsService) {
        this.propertyModel = propertyModel;
        this.userModel = userModel;
        this.historyService = historyService;
        this.userInteractionsService = userInteractionsService;
    }
    async create(createPropertyDto, user) {
        try {
            const { latitude, longitude, ...restDto } = createPropertyDto;
            if (latitude !== undefined && longitude !== undefined) {
                if (!this.isValidCoordinate(latitude, longitude)) {
                    throw new common_1.BadRequestException('Invalid coordinates provided');
                }
            }
            const locationData = (latitude !== undefined && longitude !== undefined) ? {
                location: {
                    type: 'Point',
                    coordinates: [Number(longitude), Number(latitude)],
                }
            } : {};
            const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
            if (createPropertyDto.listingType === property_schema_1.ListingType.SHORT_TERM) {
                this.validateShortTermFields(createPropertyDto);
            }
            const property = new this.propertyModel({
                ...restDto,
                ...locationData,
                latitude,
                longitude,
                ownerId: user._id,
                agentId: user.role === user_schema_1.UserRole.AGENT ? user._id : undefined,
                slug: this.generateSlug(createPropertyDto.title),
                keywords: this.generateKeywords(createPropertyDto),
                approvalStatus: isAdmin ? property_schema_1.ApprovalStatus.APPROVED : property_schema_1.ApprovalStatus.PENDING,
                isActive: isAdmin,
                pricingUnit: createPropertyDto.pricingUnit ?? property_schema_1.PricingUnit.NIGHTLY,
                minNights: createPropertyDto.minNights ?? 1,
                maxNights: createPropertyDto.maxNights ?? 365,
                cleaningFee: createPropertyDto.cleaningFee ?? 0,
                serviceFee: createPropertyDto.serviceFee ?? 0,
                shortTermAmenities: createPropertyDto.shortTermAmenities ?? {},
                isInstantBookable: createPropertyDto.isInstantBookable ?? false,
                cancellationPolicy: createPropertyDto.cancellationPolicy ?? property_schema_1.CancellationPolicy.FLEXIBLE,
                advanceNoticeDays: createPropertyDto.advanceNoticeDays ?? 0,
                bookingWindowDays: createPropertyDto.bookingWindowDays ?? 365,
                unavailableDates: [],
            });
            const savedProperty = await property.save();
            this.logger.log(`Property created: ${savedProperty._id} by user ${user._id} (approvalStatus: ${savedProperty.approvalStatus})`);
            return savedProperty;
        }
        catch (error) {
            this.logger.error('Error creating property:', error);
            throw error;
        }
    }
    async findAll(filters = {}, options = {}, user) {
        try {
            const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', includeInactive = false, } = options;
            const skip = (page - 1) * limit;
            const query = {};
            if (!includeInactive) {
                query.isActive = true;
                query.approvalStatus = property_schema_1.ApprovalStatus.APPROVED;
                query.availability = property_schema_1.PropertyStatus.ACTIVE;
            }
            if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
                query.price = {};
                if (filters.minPrice !== undefined)
                    query.price.$gte = filters.minPrice;
                if (filters.maxPrice !== undefined)
                    query.price.$lte = filters.maxPrice;
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
            if (filters.latitude && filters.longitude) {
                if (filters.radius) {
                    query.location = {
                        $near: {
                            $geometry: {
                                type: 'Point',
                                coordinates: [filters.longitude, filters.latitude],
                            },
                            $maxDistance: filters.radius * 1000,
                        },
                    };
                }
            }
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
            if (filters.checkIn && filters.checkOut) {
                const bookedPropertyIds = await this.getBookedPropertyIds(filters.checkIn, filters.checkOut);
                query._id = { $nin: bookedPropertyIds };
            }
            const sort = {};
            sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
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
            if (user) {
                await this.historyService.logActivity({
                    userId: user._id,
                    activityType: history_schema_1.ActivityType.SEARCH,
                    searchQuery: JSON.stringify(filters),
                    searchFilters: filters,
                    resultsCount: total,
                    userLocation: filters.latitude && filters.longitude ? {
                        type: 'Point',
                        coordinates: [filters.longitude, filters.latitude],
                    } : undefined,
                    city: filters.city,
                });
                await this.userInteractionsService.trackInteraction({
                    userId: user._id,
                    interactionType: user_interaction_schema_1.InteractionType.SEARCH,
                    source: user_interaction_schema_1.InteractionSource.SEARCH_RESULTS,
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
        }
        catch (error) {
            this.logger.error('Error finding properties:', error);
            throw error;
        }
    }
    async findNearby(latitude, longitude, radiusKm = 5, limit = 10, user) {
        try {
            if (!this.isValidCoordinate(latitude, longitude)) {
                throw new common_1.BadRequestException('Invalid coordinates provided');
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
                availability: property_schema_1.PropertyStatus.ACTIVE,
            })
                .populate('ownerId', 'name email phoneNumber')
                .populate('agentId', 'name email phoneNumber agency')
                .limit(limit)
                .exec();
            if (user) {
                await this.historyService.logActivity({
                    userId: user._id,
                    activityType: history_schema_1.ActivityType.SEARCH,
                    searchQuery: `nearby:${latitude},${longitude},${radiusKm}km`,
                    resultsCount: properties.length,
                    userLocation: {
                        type: 'Point',
                        coordinates: [longitude, latitude],
                    },
                });
                await this.userInteractionsService.trackInteraction({
                    userId: user._id,
                    interactionType: user_interaction_schema_1.InteractionType.MAP_VIEW,
                    source: user_interaction_schema_1.InteractionSource.MAP,
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
        }
        catch (error) {
            this.logger.error('Error finding nearby properties:', error);
            throw error;
        }
    }
    async findOne(id, user) {
        try {
            if (!mongoose_2.Types.ObjectId.isValid(id)) {
                this.logger.error(`Invalid property ID received: ${id}`);
                throw new common_1.BadRequestException(`Invalid property ID format: ${id}. Expected 24-character hexadecimal string.`);
            }
            const property = await this.propertyModel
                .findById(id)
                .populate('ownerId', 'name email phoneNumber profilePicture')
                .populate('agentId', 'name email phoneNumber profilePicture agency licenseNumber')
                .exec();
            if (!property) {
                throw new common_1.NotFoundException('Property not found');
            }
            await this.propertyModel.findByIdAndUpdate(id, { $inc: { viewsCount: 1 } });
            if (user) {
                await this.historyService.logActivity({
                    userId: user._id,
                    activityType: history_schema_1.ActivityType.PROPERTY_VIEW,
                    propertyId: property._id,
                    agentId: property.agentId ? property.agentId._id : property.ownerId,
                    city: property.city,
                });
                await this.updateRecentlyViewed(user._id, property._id);
                await this.userInteractionsService.trackInteraction({
                    userId: user._id,
                    interactionType: user_interaction_schema_1.InteractionType.PROPERTY_VIEW,
                    propertyId: property._id,
                    source: user_interaction_schema_1.InteractionSource.DIRECT_LINK,
                    city: property.city,
                    propertyType: property.type,
                    price: property.price,
                    listingType: property.listingType,
                    bedrooms: property.amenities?.bedrooms,
                    bathrooms: property.amenities?.bathrooms,
                    location: property.location
                        ? {
                            type: 'Point',
                            coordinates: property.location.coordinates,
                        }
                        : undefined,
                    neighborhood: property.neighborhood,
                });
            }
            return property;
        }
        catch (error) {
            this.logger.error(`Error finding property ${id}:`, error);
            throw error;
        }
    }
    async update(id, updatePropertyDto, user) {
        try {
            const property = await this.propertyModel.findById(id);
            if (!property) {
                throw new common_1.NotFoundException('Property not found');
            }
            if (user.role !== user_schema_1.UserRole.ADMIN &&
                property.ownerId.toString() !== user._id.toString() &&
                property.agentId?.toString() !== user._id.toString()) {
                throw new common_1.ForbiddenException('You can only update your own properties');
            }
            if (updatePropertyDto.latitude !== undefined && updatePropertyDto.longitude !== undefined) {
                if (!this.isValidCoordinate(updatePropertyDto.latitude, updatePropertyDto.longitude)) {
                    throw new common_1.BadRequestException('Invalid coordinates provided');
                }
                updatePropertyDto['location'] = {
                    type: 'Point',
                    coordinates: [updatePropertyDto.longitude, updatePropertyDto.latitude],
                };
            }
            if (updatePropertyDto.title || updatePropertyDto.description) {
                updatePropertyDto.keywords = this.generateKeywords({
                    title: updatePropertyDto.title || property.title,
                    description: updatePropertyDto.description || property.description,
                    city: updatePropertyDto.city || property.city,
                    type: updatePropertyDto.type || property.type,
                });
            }
            const updatedProperty = await this.propertyModel
                .findByIdAndUpdate(id, updatePropertyDto, { new: true })
                .populate('ownerId', 'name email phoneNumber')
                .populate('agentId', 'name email phoneNumber agency')
                .exec();
            if (!updatedProperty) {
                throw new common_1.NotFoundException('Property not found after update');
            }
            this.logger.log(`Property updated: ${id} by user ${user._id}`);
            return updatedProperty;
        }
        catch (error) {
            this.logger.error(`Error updating property ${id}:`, error);
            throw error;
        }
    }
    async getAllPropertiesAdmin(filters = {}, options = {}) {
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
        const skip = (page - 1) * limit;
        const query = {};
        if (filters.approvalStatus)
            query.approvalStatus = filters.approvalStatus;
        if (filters.propertyType)
            query.type = filters.propertyType;
        if (filters.listingType)
            query.listingType = filters.listingType;
        if (filters.city)
            query.city = { $regex: filters.city, $options: 'i' };
        if (filters.ownerId)
            query.ownerId = new mongoose_2.Types.ObjectId(filters.ownerId);
        if (filters.search) {
            query.$or = [
                { title: { $regex: filters.search, $options: 'i' } },
                { city: { $regex: filters.search, $options: 'i' } },
                { address: { $regex: filters.search, $options: 'i' } },
            ];
        }
        const sort = {};
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
    async approveProperty(id, admin) {
        const property = await this.propertyModel.findById(id);
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        if (admin.role !== user_schema_1.UserRole.ADMIN)
            throw new common_1.ForbiddenException('Only admins can approve properties');
        const updated = await this.propertyModel
            .findByIdAndUpdate(id, {
            approvalStatus: property_schema_1.ApprovalStatus.APPROVED,
            isActive: true,
            $unset: { rejectionReason: '' },
        }, { new: true })
            .populate('ownerId', 'name email phoneNumber')
            .populate('agentId', 'name email agency')
            .exec();
        this.logger.log(`Property ${id} approved by admin ${admin._id}`);
        return updated;
    }
    async rejectProperty(id, reason, admin) {
        const property = await this.propertyModel.findById(id);
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        if (admin.role !== user_schema_1.UserRole.ADMIN)
            throw new common_1.ForbiddenException('Only admins can reject properties');
        const updated = await this.propertyModel
            .findByIdAndUpdate(id, {
            approvalStatus: property_schema_1.ApprovalStatus.REJECTED,
            isActive: false,
            ...(reason ? { rejectionReason: reason } : {}),
        }, { new: true })
            .populate('ownerId', 'name email phoneNumber')
            .populate('agentId', 'name email agency')
            .exec();
        this.logger.log(`Property ${id} rejected by admin ${admin._id}. Reason: ${reason ?? 'none'}`);
        return updated;
    }
    async remove(id, user) {
        try {
            const property = await this.propertyModel.findById(id);
            if (!property) {
                throw new common_1.NotFoundException('Property not found');
            }
            if (user.role !== user_schema_1.UserRole.ADMIN &&
                property.ownerId.toString() !== user._id.toString()) {
                throw new common_1.ForbiddenException('You can only delete your own properties');
            }
            await this.propertyModel.findByIdAndDelete(id);
            this.logger.log(`Property deleted: ${id} by user ${user._id}`);
        }
        catch (error) {
            this.logger.error(`Error deleting property ${id}:`, error);
            throw error;
        }
    }
    async uploadImages(propertyId, files, user) {
        const property = await this.propertyModel.findById(propertyId);
        if (!property) {
            throw new common_1.NotFoundException('Property not found');
        }
        if (user.role !== user_schema_1.UserRole.ADMIN &&
            property.ownerId.toString() !== user._id.toString() &&
            property.agentId?.toString() !== user._id.toString()) {
            throw new common_1.ForbiddenException('You can only modify your own properties');
        }
        const uploads = await Promise.all(files.map(async (file, index) => {
            const publicId = `property_${propertyId}_${Date.now()}_${index}`;
            const result = await (0, cloudinary_1.uploadBufferToCloudinary)(file.buffer, {
                publicId,
                folder: 'horohouse/properties/images',
                resourceType: 'image',
                transformation: [
                    { quality: 'auto', fetch_format: 'auto' },
                ],
            });
            return { url: result.secure_url, publicId: result.public_id };
        }));
        property.images = [...(property.images || []), ...uploads];
        await property.save();
        return property;
    }
    async deleteImage(propertyId, imagePublicId, user) {
        const property = await this.propertyModel.findById(propertyId);
        if (!property) {
            throw new common_1.NotFoundException('Property not found');
        }
        if (user.role !== user_schema_1.UserRole.ADMIN &&
            property.ownerId.toString() !== user._id.toString() &&
            property.agentId?.toString() !== user._id.toString()) {
            throw new common_1.ForbiddenException('You can only modify your own properties');
        }
        await (0, cloudinary_1.deleteFromCloudinary)(imagePublicId, 'image');
        property.images = (property.images || []).filter((img) => img.publicId !== imagePublicId);
        await property.save();
        return property;
    }
    async uploadVideos(propertyId, files, user) {
        const property = await this.propertyModel.findById(propertyId);
        if (!property) {
            throw new common_1.NotFoundException('Property not found');
        }
        if (user.role !== user_schema_1.UserRole.ADMIN &&
            property.ownerId.toString() !== user._id.toString() &&
            property.agentId?.toString() !== user._id.toString()) {
            throw new common_1.ForbiddenException('You can only modify your own properties');
        }
        const uploads = await Promise.all(files.map(async (file, index) => {
            const publicId = `property_${propertyId}_video_${Date.now()}_${index}`;
            const result = await (0, cloudinary_1.uploadBufferToCloudinary)(file.buffer, {
                publicId,
                folder: 'horohouse/properties/videos',
                resourceType: 'video',
                transformation: [
                    { quality: 'auto' },
                ],
            });
            return { url: result.secure_url, publicId: result.public_id };
        }));
        property.videos = [...(property.videos || []), ...uploads];
        await property.save();
        return property;
    }
    async deleteVideo(propertyId, videoPublicId, user) {
        const property = await this.propertyModel.findById(propertyId);
        if (!property) {
            throw new common_1.NotFoundException('Property not found');
        }
        if (user.role !== user_schema_1.UserRole.ADMIN &&
            property.ownerId.toString() !== user._id.toString() &&
            property.agentId?.toString() !== user._id.toString()) {
            throw new common_1.ForbiddenException('You can only modify your own properties');
        }
        await (0, cloudinary_1.deleteFromCloudinary)(videoPublicId, 'video');
        property.videos = (property.videos || []).filter((vid) => vid.publicId !== videoPublicId);
        await property.save();
        return property;
    }
    async getMostViewed(limit = 10) {
        return this.propertyModel
            .find({ isActive: true, availability: property_schema_1.PropertyStatus.ACTIVE })
            .sort({ viewsCount: -1 })
            .limit(limit)
            .populate('ownerId', 'name profilePicture')
            .populate('agentId', 'name profilePicture agency')
            .exec();
    }
    async getRecent(limit = 10) {
        return this.propertyModel
            .find({ isActive: true, availability: property_schema_1.PropertyStatus.ACTIVE })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('ownerId', 'name profilePicture')
            .populate('agentId', 'name profilePicture agency')
            .exec();
    }
    async getSimilarProperties(propertyId, limit = 6) {
        try {
            if (!mongoose_2.Types.ObjectId.isValid(propertyId)) {
                this.logger.error(`Invalid property ID format: ${propertyId}`);
                throw new common_1.BadRequestException('Invalid property ID format');
            }
            const property = await this.propertyModel.findById(propertyId);
            if (!property) {
                this.logger.error(`Property not found: ${propertyId}`);
                throw new common_1.NotFoundException('Property not found');
            }
            this.logger.log(`Finding similar properties for: ${propertyId}`);
            this.logger.log(`Reference property - type: ${property.type}, city: ${property.city}, price: ${property.price}, listingType: ${property.listingType}`);
            const priceMin = property.price * 0.7;
            const priceMax = property.price * 1.3;
            const buildBaseQuery = (includePrice = true, includeType = true) => {
                const query = {
                    _id: { $ne: property._id },
                    isActive: true,
                    availability: property_schema_1.PropertyStatus.ACTIVE,
                };
                if (property.city) {
                    query.city = { $regex: new RegExp(`^${property.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
                }
                if (property.listingType) {
                    query.listingType = property.listingType;
                }
                if (includeType && property.type) {
                    query.type = property.type;
                }
                if (includePrice) {
                    query.price = { $gte: priceMin, $lte: priceMax };
                }
                return query;
            };
            const propertyIds = new Set();
            const properties = [];
            const addUniqueProperties = (newProperties) => {
                for (const prop of newProperties) {
                    const id = prop._id.toString();
                    if (!propertyIds.has(id)) {
                        propertyIds.add(id);
                        properties.push(prop);
                    }
                }
            };
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
                                $maxDistance: 10000,
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
                    addUniqueProperties(nearbyProperties);
                    this.logger.log(`Found ${nearbyProperties.length} properties using location-based search`);
                }
                catch (locationError) {
                    this.logger.warn(`Location search failed (geospatial index may be missing): ${locationError.message}`);
                }
            }
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
                addUniqueProperties(standardProperties);
                this.logger.log(`Found ${standardProperties.length} additional properties`);
            }
            if (properties.length < limit) {
                this.logger.log(`Strategy 3: Same city, type, listing - relaxed price (count: ${properties.length})`);
                const remainingLimit = limit - properties.length;
                const relaxedPriceProperties = await this.propertyModel
                    .find(buildBaseQuery(false, true))
                    .populate('ownerId', 'name profilePicture')
                    .populate('agentId', 'name profilePicture agency')
                    .sort({ createdAt: -1 })
                    .limit(remainingLimit)
                    .lean()
                    .exec();
                addUniqueProperties(relaxedPriceProperties);
                this.logger.log(`Found ${relaxedPriceProperties.length} properties with relaxed price`);
            }
            if (properties.length < limit) {
                this.logger.log(`Strategy 4: Same city and listing type only (count: ${properties.length})`);
                const remainingLimit = limit - properties.length;
                const fallbackProperties = await this.propertyModel
                    .find(buildBaseQuery(false, false))
                    .populate('ownerId', 'name profilePicture')
                    .populate('agentId', 'name profilePicture agency')
                    .sort({ createdAt: -1 })
                    .limit(remainingLimit)
                    .lean()
                    .exec();
                addUniqueProperties(fallbackProperties);
                this.logger.log(`Found ${fallbackProperties.length} fallback properties`);
            }
            this.logger.log(`Final result: ${properties.length} similar properties for property ${propertyId}`);
            return properties.slice(0, limit);
        }
        catch (error) {
            this.logger.error(`Error finding similar properties for ${propertyId}:`, error);
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            this.logger.error('Unexpected error, returning empty array');
            return [];
        }
    }
    async getUserFavorites(userId, options = {}) {
        try {
            const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', } = options;
            const skip = (page - 1) * limit;
            const userDoc = await this.userModel
                .findById(userId)
                .select('favorites')
                .lean()
                .exec();
            if (!userDoc) {
                throw new common_1.NotFoundException('User not found');
            }
            const favoriteIds = userDoc.favorites || [];
            const total = favoriteIds.length;
            if (total === 0) {
                return { properties: [], total: 0, page, totalPages: 0 };
            }
            const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
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
        }
        catch (error) {
            this.logger.error(`Error getting user favorites for ${userId}:`, error);
            throw error;
        }
    }
    async getMyProperties(filters = {}, options = {}, userId, user) {
        try {
            const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', includeInactive = true, } = options;
            const skip = (page - 1) * limit;
            const userObjectId = new mongoose_2.Types.ObjectId(userId);
            const query = {
                ownerId: userObjectId,
            };
            if (!includeInactive) {
                query.isActive = true;
                query.availability = property_schema_1.PropertyStatus.ACTIVE;
            }
            if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
                query.price = {};
                if (filters.minPrice !== undefined)
                    query.price.$gte = filters.minPrice;
                if (filters.maxPrice !== undefined)
                    query.price.$lte = filters.maxPrice;
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
            const sort = {};
            sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
            this.logger.log(`Querying properties with: ${JSON.stringify(query)}`);
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
        }
        catch (error) {
            this.logger.error(`Error getting user properties for ${userId}:`, error);
            throw error;
        }
    }
    async getFeatured(limit = 10) {
        return this.propertyModel
            .find({ isActive: true, isFeatured: true, availability: property_schema_1.PropertyStatus.ACTIVE })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('ownerId', 'name profilePicture')
            .populate('agentId', 'name profilePicture agency')
            .exec();
    }
    async getPopularCities(limit = 10) {
        return this.propertyModel.aggregate([
            { $match: { isActive: true, availability: property_schema_1.PropertyStatus.ACTIVE } },
            { $group: { _id: '$city', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: limit },
            { $project: { _id: 0, city: '$_id', count: 1 } },
        ]);
    }
    async geocodeAddress(address, city, country) {
        try {
            const query = [address, city, country]
                .filter(value => value && value.trim())
                .join(', ');
            const response = await axios_1.default.get('https://nominatim.openstreetmap.org/search', {
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
            this.logger.warn(`Geocoding failed for address: ${query}`);
            return null;
        }
        catch (error) {
            this.logger.error('Geocoding failed:', error);
            return null;
        }
    }
    async searchByText(searchText, filters = {}, options = {}, user) {
        try {
            const query = {
                $text: { $search: searchText },
                isActive: true,
                availability: property_schema_1.PropertyStatus.ACTIVE,
                ...this.buildFilterQuery(filters),
            };
            const { page = 1, limit = 20, sortBy = 'score' } = options;
            const skip = (page - 1) * limit;
            let sort = {};
            if (sortBy === 'score') {
                sort = { score: { $meta: 'textScore' } };
            }
            else {
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
            if (user) {
                await this.historyService.logActivity({
                    userId: user._id,
                    activityType: history_schema_1.ActivityType.SEARCH,
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
        }
        catch (error) {
            this.logger.error('Text search failed:', error);
            throw error;
        }
    }
    isValidCoordinate(latitude, longitude) {
        return (latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180);
    }
    generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }
    generateKeywords(property) {
        const keywords = [];
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
    async trackTourView(propertyId) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId))
            return;
        await this.propertyModel
            .findByIdAndUpdate(propertyId, { $inc: { tourViews: 1 } })
            .exec();
    }
    buildFilterQuery(filters) {
        const query = {};
        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            query.price = {};
            if (filters.minPrice !== undefined)
                query.price.$gte = filters.minPrice;
            if (filters.maxPrice !== undefined)
                query.price.$lte = filters.maxPrice;
        }
        if (filters.propertyType)
            query.type = filters.propertyType;
        if (filters.listingType)
            query.listingType = filters.listingType;
        if (filters.city)
            query.city = { $regex: filters.city, $options: 'i' };
        if (filters.bedrooms)
            query['amenities.bedrooms'] = { $gte: filters.bedrooms };
        if (filters.bathrooms)
            query['amenities.bathrooms'] = { $gte: filters.bathrooms };
        return query;
    }
    async updateRecentlyViewed(userId, propertyId) {
        try {
            this.logger.log(`Updating recently viewed for user ${userId}, property ${propertyId}`);
            await this.userModel.updateOne({ _id: userId }, { $pull: { recentlyViewed: { propertyId: propertyId } } });
            const result = await this.userModel.updateOne({ _id: userId }, {
                $push: {
                    recentlyViewed: {
                        $each: [{ propertyId: propertyId, viewedAt: new Date() }],
                        $position: 0,
                        $slice: 50,
                    },
                },
            });
            this.logger.log(`Recently viewed updated: ${result.modifiedCount} document(s) modified`);
        }
        catch (error) {
            this.logger.error('Failed to update recently viewed:', error);
        }
    }
    async getShortTermListings(filters = {}, options = {}) {
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
        const skip = (page - 1) * limit;
        const query = {
            listingType: property_schema_1.ListingType.SHORT_TERM,
            isActive: true,
            approvalStatus: property_schema_1.ApprovalStatus.APPROVED,
            availability: property_schema_1.PropertyStatus.ACTIVE,
        };
        if (filters.city)
            query.city = { $regex: filters.city, $options: 'i' };
        if (filters.propertyType)
            query.type = filters.propertyType;
        if (filters.pricingUnit)
            query.pricingUnit = filters.pricingUnit;
        if (filters.cancellationPolicy)
            query.cancellationPolicy = filters.cancellationPolicy;
        if (filters.isInstantBookable !== undefined) {
            query.isInstantBookable = filters.isInstantBookable;
        }
        if (filters.minGuests) {
            query['shortTermAmenities.maxGuests'] = { $gte: filters.minGuests };
        }
        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            query.price = {};
            if (filters.minPrice !== undefined)
                query.price.$gte = filters.minPrice;
            if (filters.maxPrice !== undefined)
                query.price.$lte = filters.maxPrice;
        }
        if (filters.latitude && filters.longitude && filters.radius) {
            query.location = {
                $near: {
                    $geometry: { type: 'Point', coordinates: [filters.longitude, filters.latitude] },
                    $maxDistance: filters.radius * 1000,
                },
            };
        }
        if (filters.checkIn && filters.checkOut) {
            const bookedIds = await this.getBookedPropertyIds(filters.checkIn, filters.checkOut);
            if (bookedIds.length > 0) {
                query._id = { $nin: bookedIds };
            }
        }
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
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
    async blockDates(propertyId, dto, user) {
        const property = await this.propertyModel.findById(propertyId);
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        if (property.listingType !== property_schema_1.ListingType.SHORT_TERM) {
            throw new common_1.BadRequestException('Date blocking is only available for short-term listings');
        }
        const newRanges = dto.ranges.map((r) => {
            const from = new Date(r.from);
            const to = new Date(r.to);
            if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                throw new common_1.BadRequestException(`Invalid date range: ${r.from} → ${r.to}`);
            }
            if (to <= from) {
                throw new common_1.BadRequestException(`"to" must be after "from" in range: ${r.from} → ${r.to}`);
            }
            return { from, to, reason: r.reason };
        });
        const existingRanges = property.unavailableDates ?? [];
        const existingFromSet = new Set(existingRanges.map((r) => r.from.toISOString()));
        const toAdd = newRanges.filter((r) => !existingFromSet.has(r.from.toISOString()));
        const updated = await this.propertyModel
            .findByIdAndUpdate(propertyId, { $push: { unavailableDates: { $each: toAdd } } }, { new: true })
            .exec();
        this.logger.log(`Blocked ${toAdd.length} date range(s) on property ${propertyId} by user ${user._id}`);
        return updated;
    }
    async unblockDates(propertyId, dto, user) {
        const property = await this.propertyModel.findById(propertyId);
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        this.assertCanManage(property, user);
        const fromDatesToRemove = dto.fromDates.map((d) => {
            const parsed = new Date(d);
            if (isNaN(parsed.getTime())) {
                throw new common_1.BadRequestException(`Invalid date: ${d}`);
            }
            return parsed;
        });
        const updated = await this.propertyModel
            .findByIdAndUpdate(propertyId, {
            $pull: {
                unavailableDates: {
                    from: { $in: fromDatesToRemove },
                },
            },
        }, { new: true })
            .exec();
        this.logger.log(`Unblocked ${fromDatesToRemove.length} date range(s) on property ${propertyId}`);
        return updated;
    }
    async getBlockedDates(propertyId) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId)) {
            throw new common_1.BadRequestException('Invalid property ID');
        }
        const property = await this.propertyModel
            .findById(propertyId)
            .select('unavailableDates listingType')
            .lean()
            .exec();
        if (!property)
            throw new common_1.NotFoundException('Property not found');
        return { unavailableDates: property.unavailableDates ?? [] };
    }
    async getShortTermById(propertyId) {
        if (!mongoose_2.Types.ObjectId.isValid(propertyId)) {
            throw new common_1.BadRequestException('Invalid property ID');
        }
        const property = await this.propertyModel
            .findOne({
            _id: new mongoose_2.Types.ObjectId(propertyId),
            listingType: property_schema_1.ListingType.SHORT_TERM,
            isActive: true,
            approvalStatus: property_schema_1.ApprovalStatus.APPROVED,
        })
            .populate('ownerId', 'name email phoneNumber profilePicture')
            .populate('agentId', 'name email phoneNumber profilePicture agency')
            .lean()
            .exec();
        if (!property) {
            throw new common_1.NotFoundException('Short-term property not found');
        }
        return {
            ...property,
            shortTermSummary: {
                pricePerNight: property.pricingUnit === 'nightly' ? property.price : null,
                pricingUnit: property.pricingUnit,
                minNights: property.minNights,
                maxNights: property.maxNights,
                cleaningFee: property.cleaningFee,
                isInstantBookable: property.isInstantBookable,
                cancellationPolicy: property.cancellationPolicy,
                checkInTime: property.shortTermAmenities?.checkInTime,
                checkOutTime: property.shortTermAmenities?.checkOutTime,
                maxGuests: property.shortTermAmenities?.maxGuests,
                advanceNoticeDays: property.advanceNoticeDays,
                bookingWindowDays: property.bookingWindowDays,
            },
        };
    }
    async getBookedPropertyIds(checkIn, checkOut) {
        const bookingModel = this.propertyModel.db.model('Booking');
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
        return bookings.map((b) => b.propertyId);
    }
    validateShortTermFields(dto) {
        if (!dto.pricingUnit) {
            throw new common_1.BadRequestException('pricingUnit is required for short-term listings (nightly / weekly / monthly)');
        }
        if (dto.minNights && dto.maxNights && dto.minNights > dto.maxNights) {
            throw new common_1.BadRequestException('minNights cannot be greater than maxNights');
        }
        if (dto.shortTermAmenities?.checkInTime &&
            !/^\d{2}:\d{2}$/.test(dto.shortTermAmenities.checkInTime)) {
            throw new common_1.BadRequestException('checkInTime must be in HH:mm format');
        }
        if (dto.shortTermAmenities?.checkOutTime &&
            !/^\d{2}:\d{2}$/.test(dto.shortTermAmenities.checkOutTime)) {
            throw new common_1.BadRequestException('checkOutTime must be in HH:mm format');
        }
    }
    assertCanManage(property, user) {
        const isOwner = property.ownerId.toString() === user._id.toString();
        const isAgent = property.agentId?.toString() === user._id.toString();
        const isAdmin = user.role === user_schema_1.UserRole.ADMIN;
        if (!isOwner && !isAgent && !isAdmin) {
            throw new common_1.ForbiddenException('You can only manage your own properties');
        }
    }
};
exports.PropertiesService = PropertiesService;
exports.PropertiesService = PropertiesService = PropertiesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(property_schema_1.Property.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        history_service_1.HistoryService,
        user_interactions_service_1.UserInteractionsService])
], PropertiesService);
//# sourceMappingURL=properties.service.js.map