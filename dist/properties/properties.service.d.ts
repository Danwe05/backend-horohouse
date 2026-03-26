import { Model, Types } from 'mongoose';
import { Property, PropertyDocument, PropertyType, ApprovalStatus, ListingType, PricingUnit, CancellationPolicy } from './schemas/property.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { HistoryService } from '../history/history.service';
import { UserInteractionsService } from '../user-interactions/user-interactions.service';
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
    latitude?: number;
    longitude?: number;
    radius?: number;
    bounds?: {
        northeast: {
            lat: number;
            lng: number;
        };
        southwest: {
            lat: number;
            lng: number;
        };
    };
    isInstantBookable?: boolean;
    minGuests?: number;
    cancellationPolicy?: CancellationPolicy;
    pricingUnit?: PricingUnit;
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
export declare class PropertiesService {
    private propertyModel;
    private userModel;
    private historyService;
    private userInteractionsService;
    private readonly logger;
    constructor(propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>, historyService: HistoryService, userInteractionsService: UserInteractionsService);
    create(createPropertyDto: CreatePropertyDto, user: User): Promise<Property>;
    findAll(filters?: PropertySearchFilters, options?: PropertySearchOptions, user?: User): Promise<{
        properties: Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    findNearby(latitude: number, longitude: number, radiusKm?: number, limit?: number, user?: User): Promise<Property[]>;
    findOne(id: string, user?: User): Promise<Property>;
    update(id: string, updatePropertyDto: UpdatePropertyDto, user: User): Promise<Property>;
    getAllPropertiesAdmin(filters?: {
        approvalStatus?: ApprovalStatus;
        propertyType?: PropertyType;
        listingType?: ListingType;
        city?: string;
        ownerId?: string;
        search?: string;
    }, options?: PropertySearchOptions): Promise<{
        properties: Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    approveProperty(id: string, admin: User): Promise<Property>;
    rejectProperty(id: string, reason: string | undefined, admin: User): Promise<Property>;
    remove(id: string, user: User): Promise<void>;
    uploadImages(propertyId: string, files: {
        buffer: Buffer;
        filename?: string;
    }[], user: User): Promise<Property>;
    deleteImage(propertyId: string, imagePublicId: string, user: User): Promise<Property>;
    uploadVideos(propertyId: string, files: {
        buffer: Buffer;
        filename?: string;
    }[], user: User): Promise<Property>;
    deleteVideo(propertyId: string, videoPublicId: string, user: User): Promise<Property>;
    getMostViewed(limit?: number): Promise<Property[]>;
    getRecent(limit?: number): Promise<Property[]>;
    getSimilarProperties(propertyId: string, limit?: number): Promise<Property[]>;
    getUserFavorites(userId: string, options?: PropertySearchOptions): Promise<{
        properties: any[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getMyProperties(filters: PropertySearchFilters | undefined, options: PropertySearchOptions | undefined, userId: string, user?: User): Promise<{
        properties: Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getFeatured(limit?: number): Promise<Property[]>;
    getPopularCities(limit?: number): Promise<Array<{
        city: string;
        count: number;
    }>>;
    geocodeAddress(address: string, city?: string, country?: string): Promise<{
        latitude: number;
        longitude: number;
    } | null>;
    searchByText(searchText: string, filters?: PropertySearchFilters, options?: PropertySearchOptions, user?: User): Promise<{
        properties: (import("mongoose").Document<unknown, {}, PropertyDocument, {}, {}> & Property & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    private isValidCoordinate;
    private generateSlug;
    private generateKeywords;
    trackTourView(propertyId: string): Promise<void>;
    private buildFilterQuery;
    private updateRecentlyViewed;
    getShortTermListings(filters?: {
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
    }, options?: {
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{
        properties: Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    blockDates(propertyId: string, dto: BlockDatesDto, user: User): Promise<Property>;
    unblockDates(propertyId: string, dto: UnblockDatesDto, user: User): Promise<Property>;
    getBlockedDates(propertyId: string): Promise<{
        unavailableDates: any[];
    }>;
    getShortTermById(propertyId: string): Promise<any>;
    private getBookedPropertyIds;
    validateShortTermFields(dto: any): void;
    private assertCanManage;
}
