import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
// Fastify multipart provides files on request via parts()

import { PropertiesService, PropertySearchFilters, PropertySearchOptions, CreatePropertyDto, UpdatePropertyDto } from './properties.service';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles, Public } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/schemas/user.schema';
import { PropertyType, ListingType } from './schemas/property.schema';

// DTOs for API documentation
class CreatePropertyRequestDto {
  title: string;
  price: number;
  type: PropertyType;
  listingType: ListingType;
  description: string;
  city: string;
  address: string;
  neighborhood?: string;
  country: string;
  latitude: number;
  longitude: number;
  amenities?: any;
  images?: any[];
  contactPhone?: string;
  contactEmail?: string;
  area?: number;
  yearBuilt?: number;
  keywords?: string[];
  nearbyAmenities?: string[];
  transportAccess?: string[];
}

class UpdatePropertyRequestDto extends CreatePropertyRequestDto {
  availability?: string;
  isVerified?: boolean;
  isFeatured?: boolean;
  isActive?: boolean;
}

@ApiTags('Properties')
@Controller('properties')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) { }

  @Post()
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new property' })
  @ApiBearerAuth()
  @ApiResponse({ status: 201, description: 'Property created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only agents and admins can create properties' })
  async create(
    @Body() createPropertyDto: CreatePropertyDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.create(createPropertyDto, req.user);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all properties with filtering and search' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'minPrice', required: false, type: Number, description: 'Minimum price' })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number, description: 'Maximum price' })
  @ApiQuery({ name: 'propertyType', required: false, enum: PropertyType, description: 'Property type' })
  @ApiQuery({ name: 'listingType', required: false, enum: ListingType, description: 'Listing type (sale/rent)' })
  @ApiQuery({ name: 'city', required: false, type: String, description: 'City name' })
  @ApiQuery({ name: 'bedrooms', required: false, type: Number, description: 'Minimum bedrooms' })
  @ApiQuery({ name: 'bathrooms', required: false, type: Number, description: 'Minimum bathrooms' })
  @ApiQuery({ name: 'latitude', required: false, type: Number, description: 'Latitude for location search' })
  @ApiQuery({ name: 'longitude', required: false, type: Number, description: 'Longitude for location search' })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'Search radius in kilometers' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Sort by field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
  @ApiResponse({ status: 200, description: 'Properties retrieved successfully' })
  async findAll(
    @Query() query: any,
    @Req() req: FastifyRequest & { user?: User },
  ) {
    const filters: PropertySearchFilters = {
      minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
      maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
      propertyType: query.propertyType,
      listingType: query.listingType,
      city: query.city,
      bedrooms: query.bedrooms ? parseInt(query.bedrooms) : undefined,
      bathrooms: query.bathrooms ? parseInt(query.bathrooms) : undefined,
      latitude: query.latitude ? parseFloat(query.latitude) : undefined,
      longitude: query.longitude ? parseFloat(query.longitude) : undefined,
      radius: query.radius ? parseFloat(query.radius) : undefined,
      amenities: query.amenities ? query.amenities.split(',') : undefined,
    };

    // Handle bounding box search
    if (query.bounds) {
      try {
        filters.bounds = JSON.parse(query.bounds);
      } catch (error) {
        throw new BadRequestException('Invalid bounds format');
      }
    }

    const options: PropertySearchOptions = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    };

    return this.propertiesService.findAll(filters, options, req.user);
  }

  @Get('nearby')
  @Public()
  @ApiOperation({ summary: 'Find properties near a location' })
  @ApiQuery({ name: 'latitude', required: true, type: Number })
  @ApiQuery({ name: 'longitude', required: true, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'Radius in kilometers (default: 5)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Nearby properties found' })
  @ApiResponse({ status: 400, description: 'Invalid coordinates' })
  async findNearby(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Req() req: FastifyRequest & { user?: User },
    @Query('radius') radius?: string,
    @Query('limit') limit?: string,
  ) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusKm = radius ? parseFloat(radius) : 5;
    const maxResults = limit ? parseInt(limit) : 10;

    if (isNaN(lat) || isNaN(lng)) {
      throw new BadRequestException('Valid latitude and longitude are required');
    }

    return this.propertiesService.findNearby(lat, lng, radiusKm, maxResults, req?.user);
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Text search properties' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'propertyType', required: false, enum: PropertyType })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiResponse({ status: 400, description: 'Search query is required' })
  async searchByText(
    @Query() query: any,
    @Req() req: FastifyRequest & { user?: User },
  ) {
    if (!query.q) {
      throw new BadRequestException('Search query (q) is required');
    }

    const filters: PropertySearchFilters = {
      city: query.city,
      propertyType: query.propertyType,
      minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
      maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
    };

    const options: PropertySearchOptions = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
    };

    return this.propertiesService.searchByText(query.q, filters, options, req.user);
  }

  @Get('most-viewed')
  @Public()
  @ApiOperation({ summary: 'Get most viewed properties' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Most viewed properties' })
  async getMostViewed(@Query('limit') limit?: string) {
    const maxResults = limit ? parseInt(limit) : 10;
    return this.propertiesService.getMostViewed(maxResults);
  }

  @Get('recent')
  @Public()
  @ApiOperation({ summary: 'Get recently added properties' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Recent properties' })
  async getRecent(@Query('limit') limit?: string) {
    const maxResults = limit ? parseInt(limit) : 10;
    return this.propertiesService.getRecent(maxResults);
  }

  @Get('featured')
  @Public()
  @ApiOperation({ summary: 'Get featured properties' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Featured properties' })
  async getFeatured(@Query('limit') limit?: string) {
    const maxResults = limit ? parseInt(limit) : 10;
    return this.propertiesService.getFeatured(maxResults);
  }

  @Get('popular-cities')
  @Public()
  @ApiOperation({ summary: 'Get popular cities with property counts' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Popular cities' })
  async getPopularCities(@Query('limit') limit?: string) {
    const maxResults = limit ? parseInt(limit) : 10;
    return this.propertiesService.getPopularCities(maxResults);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get property by ID' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property found' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async findOne(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user?: User },
  ) {
    return this.propertiesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update property' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only update own properties' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.update(id, updatePropertyDto, req.user);
  }

  @Delete(':id')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete property' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only delete own properties' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async remove(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    await this.propertiesService.remove(id, req.user);
    return { message: 'Property deleted successfully' };
  }

  // Property management endpoints for agents/admins
  @Get('my/properties')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current user\'s properties' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'propertyType', required: false, enum: PropertyType })
  @ApiQuery({ name: 'listingType', required: false, enum: ListingType })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean, description: 'Include inactive properties' })
  @ApiResponse({ status: 200, description: 'User properties retrieved' })
  async getMyProperties(
    @Query() query: any,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const filters: PropertySearchFilters = {
      propertyType: query.propertyType,
      listingType: query.listingType,
      city: query.city,
      minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
      maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
    };

    const options: PropertySearchOptions = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
      includeInactive: query.includeInactive !== 'false', // Default to true for user's properties
    };

    // Get user ID - ensure it exists
    const userId = req.user._id?.toString();

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    // Log for debugging
    console.log('User ID:', userId, 'Type:', typeof userId);
    console.log('Full user object:', JSON.stringify(req.user, null, 2));

    return this.propertiesService.getMyProperties(filters, options, userId, req.user);
  }

  @Patch(':id/feature')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Toggle property featured status (Admin only)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property featured status updated' })
  async toggleFeatured(
    @Param('id') id: string,
    @Body() body: { isFeatured: boolean },
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.update(id, { isFeatured: body.isFeatured }, req.user);
  }

  @Patch(':id/verify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Toggle property verification status (Admin only)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property verification status updated' })
  async toggleVerified(
    @Param('id') id: string,
    @Body() body: { isVerified: boolean },
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.update(id, { isVerified: body.isVerified }, req.user);
  }

  @Patch(':id/activate')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Toggle property active status' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property active status updated' })
  async toggleActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.propertiesService.update(id, { isActive: body.isActive }, req.user);
  }

  @Post(':id/favorite')
  @Roles(UserRole.REGISTERED_USER, UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add property to favorites' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property added to favorites' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async addToFavorites(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    // This would typically be handled by a user service
    // For now, return a success response
    return { message: 'Property added to favorites', propertyId: id };
  }

  @Delete(':id/favorite')
  @Roles(UserRole.REGISTERED_USER, UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove property from favorites' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property removed from favorites' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async removeFromFavorites(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    // This would typically be handled by a user service
    // For now, return a success response
    return { message: 'Property removed from favorites', propertyId: id };
  }

  @Get('my/favorites')
  @Roles(UserRole.REGISTERED_USER, UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current user\'s favorite properties' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'User favorite properties retrieved' })
  async getMyFavorites(
    @Query() query: any,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const options: PropertySearchOptions = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    };

    const userId = req.user._id?.toString();

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    return this.propertiesService.getUserFavorites(userId, options);
  }

  @Get(':id/similar')
  @Public()
  @ApiOperation({ summary: 'Get similar properties' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 6)' })
  @ApiResponse({ status: 200, description: 'Similar properties found' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async getSimilarProperties(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const maxResults = limit ? parseInt(limit) : 6;
    return this.propertiesService.getSimilarProperties(id, maxResults);
  }

  @Post(':id/images')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload property images' })
  @ApiBearerAuth()
  async uploadImages(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const files: { buffer: Buffer }[] = [];
    // @ts-ignore fastify types
    const parts = req.parts();
    for await (const part of parts as AsyncIterable<MultipartFile>) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(Buffer.from(chunk));
        }
        files.push({ buffer: Buffer.concat(chunks) });
      }
    }
    const property = await this.propertiesService.uploadImages(id, files, (req as any).user);
    return { message: 'Images uploaded successfully', property };
  }

  @Delete(':id/images/:imageId')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete property image' })
  @ApiBearerAuth()
  async deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const property = await this.propertiesService.deleteImage(id, imageId, (req as any).user);
    return { message: 'Image deleted successfully', property };
  }

  @Post(':id/videos')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload property videos' })
  @ApiBearerAuth()
  async uploadVideos(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const files: { buffer: Buffer }[] = [];
    // @ts-ignore fastify types
    const parts = req.parts();
    for await (const part of parts as AsyncIterable<MultipartFile>) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(Buffer.from(chunk));
        }
        files.push({ buffer: Buffer.concat(chunks) });
      }
    }
    const property = await this.propertiesService.uploadVideos(id, files, (req as any).user);
    return { message: 'Videos uploaded successfully', property };
  }

  @Delete(':id/videos/:videoId')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete property video' })
  @ApiBearerAuth()
  async deleteVideo(
    @Param('id') id: string,
    @Param('videoId') videoId: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const property = await this.propertiesService.deleteVideo(id, videoId, (req as any).user);
    return { message: 'Video deleted successfully', property };
  }
}
