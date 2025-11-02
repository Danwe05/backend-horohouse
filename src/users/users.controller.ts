import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UpdatePreferencesDto } from './dto';
import { User, UserRole } from './schemas/user.schema';
import { Roles } from '../auth/guards/roles.guard';
import { Public } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // ==========================================
  // SPECIFIC /me/* ROUTES FIRST (Most specific to least specific)
  // ==========================================

  @Get('me/viewed-properties')
  @ApiOperation({ summary: 'Get current user\'s recently viewed properties with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Sort by field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
  @ApiResponse({ status: 200, description: 'Viewed properties retrieved successfully' })
  async getMyViewedProperties(
    @Req() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.usersService.getViewedPropertiesWithPagination(req.user.id, {
      page: page ? parseInt(page.toString()) : 1,
      limit: limit ? parseInt(limit.toString()) : 20,
      sortBy: sortBy || 'viewedAt',
      sortOrder: sortOrder || 'desc',
    });
  }

  @Delete('me/viewed-properties/:propertyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove specific property from viewing history' })
  @ApiResponse({ status: 200, description: 'Property removed from viewing history' })
  async removeFromMyViewingHistory(
    @Req() req: any,
    @Param('propertyId') propertyId: string,
  ) {
    return this.usersService.removeFromViewingHistory(req.user.id, propertyId);
  }

  @Delete('me/viewed-properties')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear viewing history' })
  @ApiResponse({ status: 200, description: 'Viewing history cleared successfully' })
  async clearMyViewingHistory(@Req() req: any) {
    return this.usersService.clearViewingHistory(req.user.id);
  }

  @Get('me/favorites')
  @ApiOperation({ summary: 'Get current user favorites' })
  @ApiResponse({ status: 200, description: 'User favorites' })
  async getFavorites(@Req() req: any): Promise<User> {
    const user = await this.usersService.findOne(req.user.id);
    return user;
  }

  @Post('me/favorites/:propertyId')
  @ApiOperation({ summary: 'Add property to favorites' })
  @ApiResponse({ status: 200, description: 'Property added to favorites' })
  async addToFavorites(
    @Req() req: any,
    @Param('propertyId') propertyId: string,
  ): Promise<User> {
    return this.usersService.addToFavorites(req.user.id, propertyId);
  }

  @Delete('me/favorites/:propertyId')
  @ApiOperation({ summary: 'Remove property from favorites' })
  @ApiResponse({ status: 200, description: 'Property removed from favorites' })
  async removeFromFavorites(
    @Req() req: any,
    @Param('propertyId') propertyId: string,
  ): Promise<User> {
    return this.usersService.removeFromFavorites(req.user.id, propertyId);
  }

  @Get('me/recently-viewed')
  @ApiOperation({ summary: 'Get recently viewed properties' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items to return' })
  @ApiResponse({ status: 200, description: 'Recently viewed properties' })
  async getRecentlyViewed(
    @Req() req: any,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getRecentlyViewed(
      req.user.id,
      limit ? parseInt(limit.toString()) : 10,
    );
  }

  @Get('me/search-history')
  @ApiOperation({ summary: 'Get user search history' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items to return' })
  @ApiResponse({ status: 200, description: 'User search history' })
  async getSearchHistory(
    @Req() req: any,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getSearchHistory(
      req.user.id,
      limit ? parseInt(limit.toString()) : 20,
    );
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated successfully' })
  async updatePreferences(
    @Req() req: any,
    @Body() preferences: UpdatePreferencesDto,
  ): Promise<User> {
    return this.usersService.updatePreferences(req.user.id, preferences);
  }

  @Post('me/profile-picture')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile picture' })
  @ApiResponse({ status: 200, description: 'Profile picture uploaded successfully' })
  async uploadProfilePicture(@Req() req: any): Promise<User> {
    // Await the multipart file (Fastify multipart)
    console.log('Content-Type header:', req.headers['content-type']);
    const data = await req.file();

    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    // Convert file stream to buffer (Fastify gives a stream, so buffer is async)
    const buffer = await data.toBuffer();

    // Create an object to pass to service:
    const file = {
      buffer,
      mimetype: data.mimetype,
      fieldname: data.fieldname,
      originalname: data.filename,
      encoding: data.encoding,
    };

    // Pass user id and file object to service
    return this.usersService.uploadProfilePicture(req.user.id, file);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateMe(
    @Req() req: any,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(req.user.id, updateUserDto);
  }

  // ==========================================
  // GENERIC /me ROUTE LAST
  // ==========================================

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  async getMe(@Req() req: any): Promise<User> {
    return this.usersService.findOne(req.user.id);
  }

  // ==========================================
  // ADMIN AND PUBLIC ROUTES
  // ==========================================

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all users with pagination (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole, description: 'Filter by role' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name, email, or phone' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: boolean,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 10,
      role,
      isActive,
      search,
    );
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'User statistics' })
  async getStats() {
    return this.usersService.getStats();
  }

  @Get('agents')
  @Public()
  @ApiOperation({ summary: 'Get all agents with their statistics' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Agents retrieved successfully' })
  async getAgents(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getAgents(
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 10,
    );
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string): Promise<User> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}