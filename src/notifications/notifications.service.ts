import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
     private notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Create a new notification
   */
 async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = new this.notificationModel(createNotificationDto);
    const saved = await notification.save();
    
    // 🔥 Emit via WebSocket for real-time delivery
    this.notificationsGateway.sendNotificationToUser(
      createNotificationDto.userId,
      saved.toObject()
    );
    
    this.logger.log(`Notification created and sent: ${saved._id} for user ${createNotificationDto.userId}`);
    
    return saved;
  }

  /**
   * Create notification for multiple users
   */
  async createBulk(
    userIds: string[],
    notificationData: Omit<CreateNotificationDto, 'userId'>,
  ): Promise<any[]> {
    const notifications = userIds.map((userId) => ({
      userId,
      ...notificationData,
    }));

    const saved = await this.notificationModel.insertMany(notifications);
    
    // 🔥 Emit to all users via WebSocket
    saved.forEach((notification) => {
      this.notificationsGateway.sendNotificationToUser(
        notification.userId.toString(),
        notification.toObject()
      );
    });
    
    this.logger.log(`Bulk notifications created and sent: ${saved.length} notifications`);
    
    return saved;
  }


  /**
   * Get user notifications with pagination
   */
  async findByUser(
    userId: string,
    query: QueryNotificationDto,
  ): Promise<{
    notifications: Notification[];
    unreadCount: number;
    total: number;
  }> {
    const { limit = 20, skip = 0, unreadOnly } = query;
  
    this.logger.log(`[findByUser] Called with userId: ${userId}, query: ${JSON.stringify(query)}`);
    
    let userObjectId: Types.ObjectId;
    try {
      // Handle both string and ObjectId inputs
      if (Types.ObjectId.isValid(userId)) {
        userObjectId = new Types.ObjectId(userId);
        this.logger.log(`[findByUser] Converted userId to ObjectId: ${userObjectId}`);
      } else {
        this.logger.error(`[findByUser] Invalid userId format: ${userId}`);
        throw new Error('Invalid user ID format');
      }
    } catch (error) {
      this.logger.error(`[findByUser] Error converting userId: ${error.message}`);
      throw new Error('Invalid user ID format');
    }
  
    const filter: any = { userId: userObjectId };
    if (unreadOnly) {
      filter.read = false;
    }
  
    this.logger.log(`[findByUser] Query filter: ${JSON.stringify(filter)}`);
  
    try {
      const [notifications, total, unreadCount] = await Promise.all([
        this.notificationModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.notificationModel.countDocuments(filter),
        this.notificationModel.countDocuments({
          userId: userObjectId,
          read: false,
        }),
      ]);
    
      this.logger.log(`[findByUser] Query results: ${notifications.length} notifications, ${total} total, ${unreadCount} unread`);
    
      return {
        notifications,
        unreadCount,
        total,
      };
    } catch (error) {
      this.logger.error(`[findByUser] Database query error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const count = await this.notificationModel.countDocuments({
        userId: userObjectId,
        read: false,
      });
      
      this.logger.log(`[getUnreadCount] User ${userId} has ${count} unread notifications`);
      return count;
    } catch (error) {
      this.logger.error(`[getUnreadCount] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    try {
      const notification = await this.notificationModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(notificationId),
          userId: new Types.ObjectId(userId),
        },
        { read: true },
        { new: true },
      );

      if (!notification) {
        this.logger.warn(`[markAsRead] Notification ${notificationId} not found for user ${userId}`);
        throw new NotFoundException('Notification not found');
      }

      // 🔥 Emit read event via WebSocket (sync across devices)
      this.notificationsGateway.notifyNotificationRead(userId, notificationId);
      
      // Update unread count
      const count = await this.getUnreadCount(userId);
      this.notificationsGateway.sendUnreadCountUpdate(userId, count);

      this.logger.log(`[markAsRead] Marked notification ${notificationId} as read for user ${userId}`);
      return notification;
    } catch (error) {
      this.logger.error(`[markAsRead] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
 async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    try {
      const result = await this.notificationModel.updateMany(
        { userId: new Types.ObjectId(userId), read: false },
        { read: true },
      );

      // 🔥 Emit all-read event via WebSocket
      this.notificationsGateway.notifyAllRead(userId);
      this.notificationsGateway.sendUnreadCountUpdate(userId, 0);

      this.logger.log(`[markAllAsRead] Marked ${result.modifiedCount} notifications as read for user ${userId}`);
      return { modifiedCount: result.modifiedCount };
    } catch (error) {
      this.logger.error(`[markAllAsRead] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a notification with real-time sync
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    try {
      const result = await this.notificationModel.deleteOne({
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(userId),
      });

      if (result.deletedCount === 0) {
        this.logger.warn(`[delete] Notification ${notificationId} not found for user ${userId}`);
        throw new NotFoundException('Notification not found');
      }

      // 🔥 Emit delete event via WebSocket
      this.notificationsGateway.notifyNotificationDeleted(userId, notificationId);
      
      // Update unread count
      const count = await this.getUnreadCount(userId);
      this.notificationsGateway.sendUnreadCountUpdate(userId, count);

      this.logger.log(`[delete] Deleted notification ${notificationId} for user ${userId}`);
    } catch (error) {
      this.logger.error(`[delete] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete all read notifications
   */
  async deleteAllRead(userId: string): Promise<{ deletedCount: number }> {
    try {
      const result = await this.notificationModel.deleteMany({
        userId: new Types.ObjectId(userId),
        read: true,
      });

      this.logger.log(`[deleteAllRead] Deleted ${result.deletedCount} read notifications for user ${userId}`);
      return { deletedCount: result.deletedCount };
    } catch (error) {
      this.logger.error(`[deleteAllRead] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllForUser(userId: string): Promise<{ deletedCount: number }> {
    try {
      const result = await this.notificationModel.deleteMany({
        userId: new Types.ObjectId(userId),
      });

      this.logger.log(`[deleteAllForUser] Deleted ${result.deletedCount} notifications for user ${userId}`);
      return { deletedCount: result.deletedCount };
    } catch (error) {
      this.logger.error(`[deleteAllForUser] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper: Create inquiry notification
   */
  async createInquiryNotification(
    propertyOwnerId: string,
    inquiryId: string,
    propertyId: string,
    senderName: string,
    propertyTitle: string,
  ): Promise<Notification> {
    return this.create({
      userId: propertyOwnerId,
      type: 'inquiry' as any,
      title: 'New inquiry on your property',
      message: `${senderName} sent an inquiry about ${propertyTitle}`,
      link: `/dashboard/inquiries/${inquiryId}`,
      metadata: {
        propertyId,
        inquiryId,
      },
    });
  }

  /**
   * Helper: Create favorite notification
   */
  async createFavoriteNotification(
    propertyOwnerId: string,
    propertyId: string,
    userName: string,
    propertyTitle: string,
  ): Promise<Notification> {
    return this.create({
      userId: propertyOwnerId,
      type: 'favorite' as any,
      title: 'Someone favorited your property',
      message: `${userName} added ${propertyTitle} to their favorites`,
      link: `/properties/${propertyId}`,
      metadata: {
        propertyId,
      },
    });
  }

  /**
   * Helper: Create property update notification
   */
  async createPropertyUpdateNotification(
    userId: string,
    propertyId: string,
    propertyTitle: string,
    updateType: string,
  ): Promise<Notification> {
    return this.create({
      userId,
      type: 'property_update' as any,
      title: 'Property status updated',
      message: `${propertyTitle} has been ${updateType}`,
      link: `/properties/${propertyId}`,
      metadata: {
        propertyId,
        updateType,
      },
    });
  }

  /**
   * Helper: Notify user when an agent replies to their inquiry
   */
  async createInquiryResponseNotification(
    userId: string,
    inquiryId: string,
    propertyId: string,
    agentName: string,
    responseSnippet?: string,
  ): Promise<Notification> {
    const message = responseSnippet
      ? `${agentName} replied: ${responseSnippet}`
      : `${agentName} replied to your inquiry.`;

    return this.create({
      userId,
      type: 'inquiry' as any,
      title: 'Agent replied to your inquiry',
      message,
      link: `/dashboard/inquiries/${inquiryId}`,
      metadata: {
        inquiryId,
        propertyId,
      },
    });
  }
}