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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto, RespondReviewDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles, Public } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/schemas/user.schema';
import { ReviewType } from './schemas/review.schema';

@ApiTags('Reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a review' })
  @ApiBearerAuth()
  @ApiResponse({ status: 201, description: 'Review created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Property/Agent not found' })
  async create(
    @Body() createReviewDto: CreateReviewDto,
    @Req() req: any,
  ) {
    return this.reviewsService.create(createReviewDto, req.user);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all reviews with filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'reviewType', required: false, enum: ReviewType })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'agentId', required: false, type: String })
  @ApiQuery({ name: 'minRating', required: false, type: Number })
  @ApiQuery({ name: 'maxRating', required: false, type: Number })
  @ApiQuery({ name: 'verified', required: false, type: Boolean })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Reviews retrieved successfully' })
  async findAll(@Query() query: any) {
    const filters = {
      reviewType: query.reviewType,
      propertyId: query.propertyId,
      agentId: query.agentId,
      minRating: query.minRating ? parseFloat(query.minRating) : undefined,
      maxRating: query.maxRating ? parseFloat(query.maxRating) : undefined,
      verified: query.verified === 'true' ? true : query.verified === 'false' ? false : undefined,
    };

    const options = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    };

    return this.reviewsService.findAll(filters, options);
  }

  @Get('property/:propertyId')
  @Public()
  @ApiOperation({ summary: 'Get reviews for a property' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Property reviews retrieved' })
  async getPropertyReviews(
    @Param('propertyId') propertyId: string,
    @Query() query: any,
  ) {
    const options = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    };

    return this.reviewsService.getPropertyReviews(propertyId, options);
  }

  @Get('property/:propertyId/stats')
  @Public()
  @ApiOperation({ summary: 'Get review statistics for a property' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Property review stats retrieved' })
  async getPropertyReviewStats(@Param('propertyId') propertyId: string) {
    return this.reviewsService.getPropertyReviewStats(propertyId);
  }

  @Get('agent/:agentId')
  @Public()
  @ApiOperation({ summary: 'Get reviews for an agent' })
  @ApiParam({ name: 'agentId', description: 'Agent ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Agent reviews retrieved' })
  async getAgentReviews(
    @Param('agentId') agentId: string,
    @Query() query: any,
  ) {
    const options = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    };

    return this.reviewsService.getAgentReviews(agentId, options);
  }

  @Get('agent/:agentId/stats')
  @Public()
  @ApiOperation({ summary: 'Get review statistics for an agent' })
  @ApiParam({ name: 'agentId', description: 'Agent ID' })
  @ApiResponse({ status: 200, description: 'Agent review stats retrieved' })
  async getAgentReviewStats(@Param('agentId') agentId: string) {
    return this.reviewsService.getAgentReviewStats(agentId);
  }

  @Get('my-reviews')
  @ApiOperation({ summary: 'Get current user\'s reviews' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'User reviews retrieved' })
  async getMyReviews(@Req() req: any, @Query() query: any) {
    const options = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    };

    return this.reviewsService.getUserReviews(req.user.id, options);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get review by ID' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({ status: 200, description: 'Review found' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update review' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({ status: 200, description: 'Review updated successfully' })
  @ApiResponse({ status: 403, description: 'Can only update own reviews' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async update(
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @Req() req: any,
  ) {
    return this.reviewsService.update(id, updateReviewDto, req.user);
  }

  @Post(':id/respond')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Respond to a review (Agent/Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({ status: 200, description: 'Response added successfully' })
  @ApiResponse({ status: 403, description: 'Can only respond to your own reviews' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async respondToReview(
    @Param('id') id: string,
    @Body() respondReviewDto: RespondReviewDto,
    @Req() req: any,
  ) {
    return this.reviewsService.respondToReview(id, respondReviewDto, req.user);
  }

  @Post(':id/helpful')
  @ApiOperation({ summary: 'Mark review as helpful' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({ status: 200, description: 'Review helpful status toggled' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async markAsHelpful(@Param('id') id: string, @Req() req: any) {
return this.reviewsService.markAsHelpful(id, req.user);
}
@Delete(':id')
@ApiOperation({ summary: 'Delete review' })
@ApiBearerAuth()
@ApiParam({ name: 'id', description: 'Review ID' })
@ApiResponse({ status: 200, description: 'Review deleted successfully' })
@ApiResponse({ status: 403, description: 'Can only delete own reviews' })
@ApiResponse({ status: 404, description: 'Review not found' })
async remove(@Param('id') id: string, @Req() req: any) {
await this.reviewsService.remove(id, req.user);
return { message: 'Review deleted successfully' };
}
}