import { IsString, IsNumber, IsEnum, IsOptional, Min, Max, MinLength, MaxLength, IsMongoId, IsArray } from 'class-validator';
import { ReviewType } from '../schemas/review.schema';

export class CreateReviewDto {
  @IsEnum(ReviewType)
  reviewType: ReviewType;

  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @IsOptional()
  @IsMongoId()
  agentId?: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MinLength(10, { message: 'Review must be at least 10 characters long' })
  @MaxLength(1000, { message: 'Review must not exceed 1000 characters' })
  comment: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class UpdateReviewDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class RespondReviewDto {
  @IsString()
  @MinLength(10, { message: 'Response must be at least 10 characters long' })
  @MaxLength(500, { message: 'Response must not exceed 500 characters' })
  response: string;
}