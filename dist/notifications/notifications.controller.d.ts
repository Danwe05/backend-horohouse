import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    getNotifications(req: any, query: QueryNotificationDto): Promise<{
        notifications: import("./schemas/notification.schema").Notification[];
        unreadCount: number;
        total: number;
    }>;
    getUnreadCount(req: any): Promise<{
        count: number;
    }>;
    markAllAsRead(req: any): Promise<{
        modifiedCount: number;
    }>;
    markAsRead(req: any, notificationId: string): Promise<import("./schemas/notification.schema").Notification>;
    deleteAllRead(req: any): Promise<{
        deletedCount: number;
    }>;
    deleteAll(req: any): Promise<{
        deletedCount: number;
    }>;
    deleteNotification(req: any, notificationId: string): Promise<void>;
}
