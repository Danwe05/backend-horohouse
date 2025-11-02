import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get user notifications
   * GET /api/v1/notifications
   */
  @Get()
  async getNotifications(@Req() req, @Query() query: QueryNotificationDto) {
    console.log('[NotificationsController] req.user:', JSON.stringify(req.user));
    
    const userId = req.user.userId;
    
    if (!userId) {
      console.error('[NotificationsController] No userId found in req.user');
      throw new UnauthorizedException('User ID not found in token');
    }
    
    console.log('[NotificationsController] Fetching notifications for userId:', userId);
    
    const result = await this.notificationsService.findByUser(userId, query);
    
    console.log('[NotificationsController] Returning result:', {
      notificationCount: result.notifications.length,
      unreadCount: result.unreadCount,
      total: result.total,
    });
    
    return result;
  }

  /**
   * Get unread notification count
   * GET /api/v1/notifications/unread-count
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req) {
    const userId = req.user.userId;
    
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }
    
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  /**
   * Mark notification as read
   * PATCH /api/v1/notifications/:id/read
   */
  @Patch(':id/read')
  async markAsRead(@Req() req, @Param('id') notificationId: string) {
    const userId = req.user.userId;
    
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }
    
    return this.notificationsService.markAsRead(notificationId, userId);
  }

  /**
   * Mark all notifications as read
   * PATCH /api/v1/notifications/read-all
   */
  @Patch('read-all')
  async markAllAsRead(@Req() req) {
    const userId = req.user.userId;
    
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }
    
    return this.notificationsService.markAllAsRead(userId);
  }

  /**
   * Delete a notification
   * DELETE /api/v1/notifications/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(@Req() req, @Param('id') notificationId: string) {
    const userId = req.user.userId;
    
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }
    
    await this.notificationsService.delete(notificationId, userId);
  }

  /**
   * Delete all read notifications
   * DELETE /api/v1/notifications/read
   */
  @Delete('read')
  async deleteAllRead(@Req() req) {
    const userId = req.user.userId;
    
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }
    
    return this.notificationsService.deleteAllRead(userId);
  }
}