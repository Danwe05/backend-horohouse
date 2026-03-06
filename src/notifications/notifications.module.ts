import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { Notification, NotificationSchema } from './schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    // Add JwtModule for WebSocket authentication
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Convert string time (e.g., '15m') to seconds
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN', '15m');
        let expiresInSeconds: number;
        
        if (expiresIn.endsWith('d')) {
          expiresInSeconds = parseInt(expiresIn) * 24 * 60 * 60; // days to seconds
        } else if (expiresIn.endsWith('h')) {
          expiresInSeconds = parseInt(expiresIn) * 60 * 60; // hours to seconds
        } else if (expiresIn.endsWith('m')) {
          expiresInSeconds = parseInt(expiresIn) * 60; // minutes to seconds
        } else if (expiresIn.endsWith('s')) {
          expiresInSeconds = parseInt(expiresIn); // already in seconds
        } else {
          // If no unit is specified, assume seconds
          expiresInSeconds = parseInt(expiresIn) || 900; // default to 15 minutes (900 seconds)
        }
        
        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: expiresInSeconds,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway, 
  ],
  exports: [
    NotificationsService,
    NotificationsGateway, 
  ],
})
export class NotificationsModule {}