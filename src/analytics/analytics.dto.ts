import { IsOptional, IsDateString, IsIn } from 'class-validator';

// Query DTOs
export class DateRangeDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AnalyticsQueryDto extends DateRangeDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity?: 'day' | 'week' | 'month';
}

export class ExportQueryDto extends DateRangeDto {
  @IsOptional()
  @IsIn(['csv', 'json', 'pdf'])
  format?: 'csv' | 'json' | 'pdf';
}

// Response DTOs
export interface KPIDto {
  value: number;
  label: string;
  change?: number;
  changePercent?: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface ChartDataPointDto {
  date: string;
  [key: string]: string | number;
}

export interface PropertyEngagementDto {
  id: string;
  title: string;
  views: number;
  inquiries: number;
  saves: number;
  price: number;
  image?: string;
  engagementScore?: number;
}

export interface CityEngagementDto {
  city: string;
  views: number;
  inquiries: number;
  properties?: number;
}

export interface ActivityDto {
  id: string;
  type: string;
  propertyTitle: string;
  timestamp: Date;
  city?: string;
  description?: string;
}

export interface ConversionMetricsDto {
  totalInquiries: number;
  responded: number;
  closed: number;
  conversionPercentage: number;
  responseRate?: number;
}

export interface InsightDto {
  type: 'success' | 'warning' | 'info' | 'neutral';
  message: string;
  actionable?: boolean;
  actionText?: string;
  actionUrl?: string;
}

// Regular User Analytics Response
export interface RegularUserAnalyticsDto {
  kpis: {
    savedProperties: KPIDto;
    recentlyViewed: KPIDto;
    contactedAgents: KPIDto;
    completedTransactions: KPIDto;
  };
  engagementOverTime: ChartDataPointDto[];
  propertyTypeInterest: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  recentActivity: ActivityDto[];
  insights: InsightDto[];
  period: {
    startDate: string;
    endDate: string;
  };
}

// Agent Analytics Response
export interface AgentAnalyticsDto {
  kpis: {
    totalViews: KPIDto;
    inquiriesReceived: KPIDto;
    savedProperties: KPIDto;
    activeListings: KPIDto;
    estimatedRevenue: KPIDto;
  };
  engagementOverTime: ChartDataPointDto[];
  topPerformingListings: PropertyEngagementDto[];
  engagementByCity: CityEngagementDto[];
  conversionRate: ConversionMetricsDto;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
  }>;
  insights: InsightDto[];
  period: {
    startDate: string;
    endDate: string;
  };
}

// Comparison Response
export interface ComparisonDto {
  metric: string;
  current: number;
  previous: number;
  change: number;
  percentChange: number;
  trend: 'up' | 'down' | 'stable';
}

export interface AnalyticsComparisonDto {
  current: RegularUserAnalyticsDto | AgentAnalyticsDto;
  previous: RegularUserAnalyticsDto | AgentAnalyticsDto;
  comparison: {
    [key: string]: ComparisonDto;
  };
  period: {
    current: {
      startDate: string;
      endDate: string;
    };
    previous: {
      startDate: string;
      endDate: string;
    };
  };
}

// Engagement Response (for /analytics/engagement endpoint)
export interface EngagementResponseDto {
  engagementOverTime: ChartDataPointDto[];
  granularity: 'day' | 'week' | 'month';
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalViews: number;
    totalSearches: number;
    totalSaves: number;
    totalInquiries?: number;
    averageDaily: {
      views: number;
      searches: number;
      saves: number;
    };
  };
}

// KPIs Response (for /analytics/kpis endpoint)
export interface KPIsResponseDto {
  savedProperties?: number;
  recentlyViewed?: number;
  contactedAgents?: number;
  completedTransactions?: number;
  totalViews?: number;
  inquiriesReceived?: number;
  activeListings?: number;
  estimatedRevenue?: number;
}

// Export Response
export interface ExportResponseDto {
  data: RegularUserAnalyticsDto | AgentAnalyticsDto;
  format: 'csv' | 'json' | 'pdf';
  generatedAt: string;
  period: {
    startDate: string;
    endDate: string;
  };
}