"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const notifications_service_1 = require("./notifications.service");
const query_notification_dto_1 = require("./dto/query-notification.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt.auth.guard");
const notification_schema_1 = require("./schemas/notification.schema");
function extractUserId(req) {
    const userId = req.user?.userId ?? req.user?._id?.toString() ?? req.user?.id;
    if (!userId) {
        throw new common_1.UnauthorizedException('User ID not found in token');
    }
    return userId;
}
let NotificationsController = class NotificationsController {
    notificationsService;
    constructor(notificationsService) {
        this.notificationsService = notificationsService;
    }
    async getNotifications(req, query) {
        const userId = extractUserId(req);
        return this.notificationsService.findByUser(userId, query);
    }
    async getUnreadCount(req) {
        const userId = extractUserId(req);
        const count = await this.notificationsService.getUnreadCount(userId);
        return { count };
    }
    async markAllAsRead(req) {
        const userId = extractUserId(req);
        return this.notificationsService.markAllAsRead(userId);
    }
    async markAsRead(req, notificationId) {
        const userId = extractUserId(req);
        return this.notificationsService.markAsRead(notificationId, userId);
    }
    async deleteAllRead(req) {
        const userId = extractUserId(req);
        return this.notificationsService.deleteAllRead(userId);
    }
    async deleteAll(req) {
        const userId = extractUserId(req);
        return this.notificationsService.deleteAllForUser(userId);
    }
    async deleteNotification(req, notificationId) {
        const userId = extractUserId(req);
        await this.notificationsService.delete(notificationId, userId);
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get notifications for the current user' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Max results (default 20)' }),
    (0, swagger_1.ApiQuery)({ name: 'skip', required: false, type: Number, description: 'Offset for pagination' }),
    (0, swagger_1.ApiQuery)({ name: 'unreadOnly', required: false, type: Boolean, description: 'Return only unread notifications' }),
    (0, swagger_1.ApiQuery)({
        name: 'type',
        required: false,
        enum: notification_schema_1.NotificationType,
        description: 'Filter by notification type (booking_request, review_received, etc.)',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Paginated notifications with unread count' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, query_notification_dto_1.QueryNotificationDto]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "getNotifications", null);
__decorate([
    (0, common_1.Get)('unread-count'),
    (0, swagger_1.ApiOperation)({ summary: 'Get unread notification count' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '{ count: number }' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "getUnreadCount", null);
__decorate([
    (0, common_1.Patch)('read-all'),
    (0, swagger_1.ApiOperation)({ summary: 'Mark all notifications as read' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '{ modifiedCount: number }' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markAllAsRead", null);
__decorate([
    (0, common_1.Patch)(':id/read'),
    (0, swagger_1.ApiOperation)({ summary: 'Mark a single notification as read' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Notification ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Updated notification' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Notification not found' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markAsRead", null);
__decorate([
    (0, common_1.Delete)('read'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete all read notifications' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '{ deletedCount: number }' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "deleteAllRead", null);
__decorate([
    (0, common_1.Delete)('all'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete all notifications for the current user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '{ deletedCount: number }' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "deleteAll", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a single notification' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Notification ID' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Deleted' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Notification not found' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "deleteNotification", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, swagger_1.ApiTags)('Notifications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('notifications'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, throttler_1.ThrottlerGuard),
    (0, common_1.UseInterceptors)(common_1.ClassSerializerInterceptor),
    (0, throttler_1.Throttle)({ default: { limit: 200, ttl: 60000 } }),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService])
], NotificationsController);
//# sourceMappingURL=notifications.controller.js.map