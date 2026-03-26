import { FastifyRequest } from 'fastify';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto, UpdatePropertyDto, BlockDatesDto, UnblockDatesDto } from './dto/property.dto';
import { User } from '../users/schemas/user.schema';
export declare class PropertiesController {
    private readonly propertiesService;
    constructor(propertiesService: PropertiesService);
    create(createPropertyDto: CreatePropertyDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/property.schema").Property>;
    findAll(query: any, req: FastifyRequest & {
        user?: User;
    }): Promise<{
        properties: import("./schemas/property.schema").Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    findNearby(latitude: string, longitude: string, req: FastifyRequest & {
        user?: User;
    }, radius?: string, limit?: string): Promise<import("./schemas/property.schema").Property[]>;
    searchByText(query: any, req: FastifyRequest & {
        user?: User;
    }): Promise<{
        properties: (import("mongoose").Document<unknown, {}, import("./schemas/property.schema").PropertyDocument, {}, {}> & import("./schemas/property.schema").Property & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getMostViewed(limit?: string): Promise<import("./schemas/property.schema").Property[]>;
    getRecent(limit?: string): Promise<import("./schemas/property.schema").Property[]>;
    getFeatured(limit?: string): Promise<import("./schemas/property.schema").Property[]>;
    getPopularCities(limit?: string): Promise<{
        city: string;
        count: number;
    }[]>;
    adminGetAllProperties(query: any, req: FastifyRequest & {
        user: User;
    }): Promise<{
        properties: import("./schemas/property.schema").Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    approveProperty(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/property.schema").Property>;
    rejectProperty(id: string, body: {
        reason?: string;
    }, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/property.schema").Property>;
    getShortTermListings(query: any): Promise<{
        properties: import("./schemas/property.schema").Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getShortTermById(id: string): Promise<any>;
    getBlockedDates(id: string): Promise<{
        unavailableDates: any[];
    }>;
    blockDates(id: string, dto: BlockDatesDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/property.schema").Property>;
    unblockDates(id: string, dto: UnblockDatesDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/property.schema").Property>;
    trackTourView(body: {
        propertyId: string;
    }): Promise<void>;
    findOne(id: string, req: FastifyRequest & {
        user?: User;
    }): Promise<import("./schemas/property.schema").Property>;
    update(id: string, updatePropertyDto: UpdatePropertyDto, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/property.schema").Property>;
    remove(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
    }>;
    getMyProperties(query: any, req: FastifyRequest & {
        user: User;
    }): Promise<{
        properties: import("./schemas/property.schema").Property[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    toggleFeatured(id: string, body: {
        isFeatured: boolean;
    }, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/property.schema").Property>;
    toggleVerified(id: string, body: {
        isVerified: boolean;
    }, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/property.schema").Property>;
    toggleActive(id: string, body: {
        isActive: boolean;
    }, req: FastifyRequest & {
        user: User;
    }): Promise<import("./schemas/property.schema").Property>;
    addToFavorites(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
        propertyId: string;
    }>;
    removeFromFavorites(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
        propertyId: string;
    }>;
    getMyFavorites(query: any, req: FastifyRequest & {
        user: User;
    }): Promise<{
        properties: any[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getSimilarProperties(id: string, limit?: string): Promise<import("./schemas/property.schema").Property[]>;
    uploadImages(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
        property: import("./schemas/property.schema").Property;
    }>;
    deleteImage(id: string, imageId: string, req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
        property: import("./schemas/property.schema").Property;
    }>;
    uploadVideos(id: string, req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
        property: import("./schemas/property.schema").Property;
    }>;
    deleteVideo(id: string, videoId: string, req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
        property: import("./schemas/property.schema").Property;
    }>;
}
