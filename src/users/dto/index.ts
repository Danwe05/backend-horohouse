import { 
  IsString, 
  IsEmail, 
  IsPhoneNumber, 
  IsEnum, 
  IsOptional, 
  IsBoolean, 
  IsNumber, 
  IsArray, 
  IsObject,
  ValidateNested,
  Min,
  Max,
  ArrayMaxSize,
  Length,
  Matches,
  IsIn
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { UserRole } from '../schemas/user.schema';

// Location DTO for geospatial data
export class LocationDto {
  @ApiProperty({ example: 'Point' })
  @IsString()
  @IsOptional()
  type?: 'Point' = 'Point';

  @ApiProperty({ 
    example: [9.2, 45.4], 
    description: 'Coordinates in [longitude, latitude] format' 
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMaxSize(2)
  coordinates: [number, number];
}

export class GetViewedPropertiesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string = 'viewedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// User Preferences DTO
export class UserPreferencesDto {
  @ApiPropertyOptional({ 
    example: 100000, 
    description: 'Minimum price in currency units' 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ 
    example: 500000, 
    description: 'Maximum price in currency units' 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ 
    example: ['apartment', 'house', 'condo'],
    description: 'Preferred property types'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  propertyTypes?: string[];

  @ApiPropertyOptional({ 
    example: ['Douala', 'Yaoundé'],
    description: 'Preferred cities'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cities?: string[];

  @ApiPropertyOptional({ 
    example: ['parking', 'gym', 'pool'],
    description: 'Preferred amenities'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ 
    example: 10, 
    description: 'Maximum radius in kilometers' 
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxRadius?: number;

  @ApiPropertyOptional({ 
    type: LocationDto,
    description: 'Preferred location coordinates'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  preferredLocation?: LocationDto;
}

// Create User DTO
export class CreateUserDto {
  @ApiProperty({ 
    example: 'John Doe', 
    description: 'Full name of the user' 
  })
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({ 
    example: 'john.doe@example.com',
    description: 'Email address (optional)'
  })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email?: string;

  @ApiProperty({ 
    example: '+237123456789',
    description: 'Phone number with country code'
  })
  @IsPhoneNumber()
  phoneNumber: string;

  @ApiPropertyOptional({ 
    enum: UserRole,
    example: UserRole.REGISTERED_USER,
    description: 'User role'
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ 
    example: 'firebase-uid-123',
    description: 'Firebase UID for authentication'
  })
  @IsString()
  @Length(10, 128)
  firebaseUid: string;

  @ApiPropertyOptional({ 
    example: 'google-id-123',
    description: 'Google OAuth ID (optional)'
  })
  @IsOptional()
  @IsString()
  googleId?: string;

  // Agent-specific fields
  @ApiPropertyOptional({ 
    example: 'LIC123456789',
    description: 'Real estate license number (for agents)'
  })
  @IsOptional()
  @IsString()
  @Length(5, 50)
  licenseNumber?: string;

  @ApiPropertyOptional({ 
    example: 'Century 21',
    description: 'Real estate agency name (for agents)'
  })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  agency?: string;

  @ApiPropertyOptional({ 
    example: 'Experienced real estate agent with 10+ years in the field',
    description: 'Professional bio (for agents)'
  })
  @IsOptional()
  @IsString()
  @Length(10, 1000)
  bio?: string;

  @ApiPropertyOptional({ 
    example: 'https://www.myagency.com',
    description: 'Website URL (for agents)'
  })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+\..+$/i, {
    message: 'Website must be a valid URL'
  })
  website?: string;

  @ApiPropertyOptional({ 
    example: '123 Main Street, Downtown',
    description: 'Office or home address'
  })
  @IsOptional()
  @IsString()
  @Length(5, 200)
  address?: string;

  @ApiPropertyOptional({ 
    example: 'Douala',
    description: 'City'
  })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  city?: string;

  @ApiPropertyOptional({ 
    example: 'Cameroon',
    description: 'Country'
  })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  country?: string;

  @ApiPropertyOptional({ 
    type: LocationDto,
    description: 'Geographic location coordinates'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({ 
    type: UserPreferencesDto,
    description: 'User preferences for property searches'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  preferences?: UserPreferencesDto;

  // Notification preferences
  @ApiPropertyOptional({ 
    example: true,
    description: 'Enable email notifications'
  })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({ 
    example: true,
    description: 'Enable SMS notifications'
  })
  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;

  @ApiPropertyOptional({ 
    example: true,
    description: 'Enable push notifications'
  })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;
}

// Update User DTO (partial version of CreateUserDto)
export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ 
    example: false,
    description: 'Mark user as active/inactive'
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ 
    example: true,
    description: 'Email verification status'
  })
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @ApiPropertyOptional({ 
    example: true,
    description: 'Phone verification status'
  })
  @IsOptional()
  @IsBoolean()
  phoneVerified?: boolean;

  @ApiPropertyOptional({ 
    example: 'https://example.com/profile.jpg',
    description: 'Profile picture URL'
  })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i, {
    message: 'Profile picture must be a valid image URL'
  })
  profilePicture?: string;

  @ApiPropertyOptional({ 
    example: 25,
    description: 'Number of properties listed (for agents)'
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  propertiesListed?: number;

  @ApiPropertyOptional({ 
    example: 12,
    description: 'Number of properties sold (for agents)'
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  propertiesSold?: number;
}

// Update Preferences DTO
export class UpdatePreferencesDto extends UserPreferencesDto {}

// Search Query DTO (for search history)
export class SearchQueryDto {
  @ApiProperty({ 
    example: 'apartment in douala',
    description: 'Search query string'
  })
  @IsString()
  @Length(1, 200)
  query: string;

  @ApiProperty({ 
    example: { minPrice: 100000, maxPrice: 500000, type: 'apartment' },
    description: 'Search filters object'
  })
  @IsObject()
  filters: any;

  @ApiPropertyOptional({ 
    type: LocationDto,
    description: 'Search location coordinates'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiProperty({ 
    example: 25,
    description: 'Number of results returned'
  })
  @IsNumber()
  @Min(0)
  resultsCount: number;
}

// Query DTOs for filtering and pagination
export class GetUsersQueryDto {
  @ApiPropertyOptional({ 
    example: 1,
    description: 'Page number'
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ 
    example: 10,
    description: 'Number of items per page'
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ 
    enum: UserRole,
    description: 'Filter by user role'
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ 
    example: true,
    description: 'Filter by active status'
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ 
    example: 'john',
    description: 'Search term for name, email, or phone'
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  search?: string;
}

// Response DTOs for better API documentation
export class UserResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  email?: string;

  @ApiProperty({ example: '+237123456789' })
  phoneNumber: string;

  @ApiProperty({ enum: UserRole, example: UserRole.REGISTERED_USER })
  role: UserRole;

  @ApiPropertyOptional({ example: 'https://example.com/profile.jpg' })
  profilePicture?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  emailVerified: boolean;

  @ApiProperty({ example: true })
  phoneVerified: boolean;

  @ApiProperty({ type: UserPreferencesDto })
  preferences: UserPreferencesDto;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  updatedAt: Date;

  // Agent-specific fields
  @ApiPropertyOptional({ example: 'LIC123456789' })
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'Century 21' })
  agency?: string;

  @ApiPropertyOptional({ example: 'Experienced agent...' })
  bio?: string;

  @ApiPropertyOptional({ example: 25 })
  propertiesListed?: number;

  @ApiPropertyOptional({ example: 12 })
  propertiesSold?: number;

  @ApiPropertyOptional({ example: 'Douala' })
  city?: string;

  @ApiPropertyOptional({ example: 'Cameroon' })
  country?: string;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  users: UserResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 10 })
  totalPages: number;
}

// Agent-specific DTOs
export class AgentStatsDto {
  @ApiProperty({ example: 25 })
  totalProperties: number;

  @ApiProperty({ example: 20 })
  activeProperties: number;
}

export class AgentResponseDto extends UserResponseDto {
  @ApiProperty({ type: AgentStatsDto })
  stats: AgentStatsDto;
}

export class PaginatedAgentsResponseDto {
  @ApiProperty({ type: [AgentResponseDto] })
  agents: AgentResponseDto[];

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

// User Statistics DTO
export class UserStatsDto {
  @ApiProperty({ example: 1500 })
  total: number;

  @ApiProperty({ example: 1450 })
  active: number;

  @ApiProperty({ example: 50 })
  agents: number;

  @ApiProperty({ example: 1200 })
  verified: number;

  @ApiProperty({ example: 100 })
  recent: number;

  @ApiProperty({ 
    example: { 
      registered_user: 1400, 
      agent: 50, 
      admin: 5 
    } 
  })
  byRole: Record<string, number>;
}