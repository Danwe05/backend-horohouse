import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

// ✅ ADD THESE TWO IMPORTS
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PropertiesModule } from './properties/properties.module';
import { HistoryModule } from './history/history.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { EmailModule } from './email/email.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SavedSearchesModule } from './saved-searches/saved-searches.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UserInteractionsModule } from './user-interactions/user-interactions.module';
import { RecommendationModule } from './recommendations/recommendation.module';
import { PaymentsModule } from './payments/payments.module';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { ChatModule } from './chat/chat.module';
import { LeadsModule } from './leads/leads.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';
import { BookingsModule } from './bookings/bookings.module';
import { ReportsModule } from './reports/reports.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: 60 * 1000,
          limit: 100,
        },
        {
          name: 'notifications',
          ttl: 60 * 1000,
          limit: 200,
        },
      ],
      inject: [ConfigService],
    }),

    // Feature Modules
    AuthModule,
    UsersModule,
    PropertiesModule,
    HistoryModule,
    AnalyticsModule,
    CloudinaryModule,
    EmailModule,
    OnboardingModule,
    NotificationsModule,
    SavedSearchesModule,
    ReviewsModule,
    UserInteractionsModule,
    RecommendationModule,
    PaymentsModule,
    AiChatModule,
    ChatModule,
    LeadsModule,
    AppointmentsModule,
    SystemSettingsModule,
    BookingsModule,
    ReportsModule,
    RoomsModule,
  ],

  // ✅ ADD THESE — without them AppController is never registered
  // and GET /api/v1/health returns 404
  controllers: [AppController],
  providers: [
    AppService, // ✅ required — AppController depends on AppService via DI
    {
      provide: APP_GUARD,
      useFactory: (configService: ConfigService) =>
        configService.get('NODE_ENV') === 'production'
          ? ThrottlerGuard
          : { canActivate: () => true },
      inject: [ConfigService],
    },
  ],
})
export class AppModule { }