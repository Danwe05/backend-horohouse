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
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const notification_schema_1 = require("./schemas/notification.schema");
const notifications_gateway_1 = require("./notifications.gateway");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    notificationModel;
    notificationsGateway;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(notificationModel, notificationsGateway) {
        this.notificationModel = notificationModel;
        this.notificationsGateway = notificationsGateway;
    }
    async create(createNotificationDto) {
        const notification = new this.notificationModel(createNotificationDto);
        const saved = await notification.save();
        this.notificationsGateway.sendNotificationToUser(createNotificationDto.userId, saved.toObject());
        this.logger.log(`Notification created and sent: ${saved._id} for user ${createNotificationDto.userId}`);
        return saved;
    }
    async createBulk(userIds, notificationData) {
        const notifications = userIds.map((userId) => ({
            userId,
            ...notificationData,
        }));
        const saved = await this.notificationModel.insertMany(notifications);
        saved.forEach((notification) => {
            this.notificationsGateway.sendNotificationToUser(notification.userId.toString(), notification.toObject());
        });
        this.logger.log(`Bulk notifications created and sent: ${saved.length} notifications`);
        return saved;
    }
    async findByUser(userId, query) {
        const { limit = 20, skip = 0, unreadOnly } = query;
        this.logger.log(`[findByUser] Called with userId: ${userId}, query: ${JSON.stringify(query)}`);
        let userObjectId;
        try {
            if (mongoose_2.Types.ObjectId.isValid(userId)) {
                userObjectId = new mongoose_2.Types.ObjectId(userId);
                this.logger.log(`[findByUser] Converted userId to ObjectId: ${userObjectId}`);
            }
            else {
                this.logger.error(`[findByUser] Invalid userId format: ${userId}`);
                throw new Error('Invalid user ID format');
            }
        }
        catch (error) {
            this.logger.error(`[findByUser] Error converting userId: ${error.message}`);
            throw new Error('Invalid user ID format');
        }
        const filter = { userId: userObjectId };
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
        }
        catch (error) {
            this.logger.error(`[findByUser] Database query error: ${error.message}`);
            throw error;
        }
    }
    async getUnreadCount(userId) {
        try {
            const userObjectId = new mongoose_2.Types.ObjectId(userId);
            const count = await this.notificationModel.countDocuments({
                userId: userObjectId,
                read: false,
            });
            this.logger.log(`[getUnreadCount] User ${userId} has ${count} unread notifications`);
            return count;
        }
        catch (error) {
            this.logger.error(`[getUnreadCount] Error: ${error.message}`);
            throw error;
        }
    }
    async markAsRead(notificationId, userId) {
        try {
            const notification = await this.notificationModel.findOneAndUpdate({
                _id: new mongoose_2.Types.ObjectId(notificationId),
                userId: new mongoose_2.Types.ObjectId(userId),
            }, { read: true }, { new: true });
            if (!notification) {
                this.logger.warn(`[markAsRead] Notification ${notificationId} not found for user ${userId}`);
                throw new common_1.NotFoundException('Notification not found');
            }
            this.notificationsGateway.notifyNotificationRead(userId, notificationId);
            const count = await this.getUnreadCount(userId);
            this.notificationsGateway.sendUnreadCountUpdate(userId, count);
            this.logger.log(`[markAsRead] Marked notification ${notificationId} as read for user ${userId}`);
            return notification;
        }
        catch (error) {
            this.logger.error(`[markAsRead] Error: ${error.message}`);
            throw error;
        }
    }
    async markAllAsRead(userId) {
        try {
            const result = await this.notificationModel.updateMany({ userId: new mongoose_2.Types.ObjectId(userId), read: false }, { read: true });
            this.notificationsGateway.notifyAllRead(userId);
            this.notificationsGateway.sendUnreadCountUpdate(userId, 0);
            this.logger.log(`[markAllAsRead] Marked ${result.modifiedCount} notifications as read for user ${userId}`);
            return { modifiedCount: result.modifiedCount };
        }
        catch (error) {
            this.logger.error(`[markAllAsRead] Error: ${error.message}`);
            throw error;
        }
    }
    async delete(notificationId, userId) {
        try {
            const result = await this.notificationModel.deleteOne({
                _id: new mongoose_2.Types.ObjectId(notificationId),
                userId: new mongoose_2.Types.ObjectId(userId),
            });
            if (result.deletedCount === 0) {
                this.logger.warn(`[delete] Notification ${notificationId} not found for user ${userId}`);
                throw new common_1.NotFoundException('Notification not found');
            }
            this.notificationsGateway.notifyNotificationDeleted(userId, notificationId);
            const count = await this.getUnreadCount(userId);
            this.notificationsGateway.sendUnreadCountUpdate(userId, count);
            this.logger.log(`[delete] Deleted notification ${notificationId} for user ${userId}`);
        }
        catch (error) {
            this.logger.error(`[delete] Error: ${error.message}`);
            throw error;
        }
    }
    async deleteAllRead(userId) {
        try {
            const result = await this.notificationModel.deleteMany({
                userId: new mongoose_2.Types.ObjectId(userId),
                read: true,
            });
            this.logger.log(`[deleteAllRead] Deleted ${result.deletedCount} read notifications for user ${userId}`);
            return { deletedCount: result.deletedCount };
        }
        catch (error) {
            this.logger.error(`[deleteAllRead] Error: ${error.message}`);
            throw error;
        }
    }
    async deleteAllForUser(userId) {
        try {
            const result = await this.notificationModel.deleteMany({
                userId: new mongoose_2.Types.ObjectId(userId),
            });
            this.logger.log(`[deleteAllForUser] Deleted ${result.deletedCount} notifications for user ${userId}`);
            return { deletedCount: result.deletedCount };
        }
        catch (error) {
            this.logger.error(`[deleteAllForUser] Error: ${error.message}`);
            throw error;
        }
    }
    async createInquiryNotification(propertyOwnerId, inquiryId, propertyId, senderName, propertyTitle) {
        return this.create({
            userId: propertyOwnerId,
            type: 'inquiry',
            title: 'New inquiry on your property',
            message: `${senderName} sent an inquiry about ${propertyTitle}`,
            link: `/dashboard/inquiry/${inquiryId}`,
            metadata: {
                propertyId,
                inquiryId,
            },
        });
    }
    async createFavoriteNotification(propertyOwnerId, propertyId, userName, propertyTitle) {
        return this.create({
            userId: propertyOwnerId,
            type: 'favorite',
            title: 'Someone favorited your property',
            message: `${userName} added ${propertyTitle} to their favorites`,
            link: `/properties/${propertyId}`,
            metadata: {
                propertyId,
            },
        });
    }
    async createPropertyUpdateNotification(userId, propertyId, propertyTitle, updateType) {
        return this.create({
            userId,
            type: 'property_update',
            title: 'Property status updated',
            message: `${propertyTitle} has been ${updateType}`,
            link: `/properties/${propertyId}`,
            metadata: {
                propertyId,
                updateType,
            },
        });
    }
    async createInquiryResponseNotification(userId, inquiryId, propertyId, agentName, responseSnippet) {
        const message = responseSnippet
            ? `${agentName} replied: ${responseSnippet}`
            : `${agentName} replied to your inquiry.`;
        return this.create({
            userId,
            type: 'inquiry',
            title: 'Agent replied to your inquiry',
            message,
            link: `/dashboard/inquiry/${inquiryId}`,
            metadata: {
                inquiryId,
                propertyId,
            },
        });
    }
    async notifyBookingRequest(hostId, params) {
        await this.create({
            userId: hostId,
            type: notification_schema_1.NotificationType.BOOKING_REQUEST,
            title: 'New booking request',
            message: `${params.guestName} requested to book ${params.propertyTitle} ` +
                `from ${params.checkIn} to ${params.checkOut}`,
            link: `/hosting/bookings/${params.bookingId}`,
            metadata: {
                bookingId: params.bookingId,
                propertyId: params.propertyId,
                propertyTitle: params.propertyTitle,
                guestName: params.guestName,
                checkIn: params.checkIn,
                checkOut: params.checkOut,
            },
        });
    }
    async notifyBookingConfirmed(guestId, params) {
        await this.create({
            userId: guestId,
            type: notification_schema_1.NotificationType.BOOKING_CONFIRMED,
            title: 'Booking confirmed! 🎉',
            message: `Your stay at ${params.propertyTitle} has been confirmed ` +
                `(${params.checkIn} → ${params.checkOut})`,
            link: `/bookings/${params.bookingId}`,
            metadata: {
                bookingId: params.bookingId,
                propertyId: params.propertyId,
                propertyTitle: params.propertyTitle,
                hostName: params.hostName,
                checkIn: params.checkIn,
                checkOut: params.checkOut,
            },
        });
    }
    async notifyBookingRejected(guestId, params) {
        await this.create({
            userId: guestId,
            type: notification_schema_1.NotificationType.BOOKING_REJECTED,
            title: 'Booking request declined',
            message: `Unfortunately, ${params.hostName} could not accommodate your request ` +
                `for ${params.propertyTitle} (${params.checkIn} → ${params.checkOut})`,
            link: `/bookings/${params.bookingId}`,
            metadata: {
                bookingId: params.bookingId,
                propertyId: params.propertyId,
                propertyTitle: params.propertyTitle,
                checkIn: params.checkIn,
                checkOut: params.checkOut,
            },
        });
    }
    async notifyBookingCancelled(params) {
        const cancellerName = params.cancelledByGuest ? params.guestName : params.hostName;
        const otherPartyId = params.cancelledByGuest ? params.hostId : params.guestId;
        const otherPartyMsg = params.cancelledByGuest
            ? `${params.guestName} cancelled their booking for ${params.propertyTitle} ` +
                `(${params.checkIn} → ${params.checkOut})`
            : `${params.hostName} cancelled your booking for ${params.propertyTitle} ` +
                `(${params.checkIn} → ${params.checkOut})`;
        await this.create({
            userId: otherPartyId,
            type: notification_schema_1.NotificationType.BOOKING_CANCELLED,
            title: 'Booking cancelled',
            message: otherPartyMsg,
            link: `/bookings/${params.bookingId}`,
            metadata: {
                bookingId: params.bookingId,
                propertyId: params.propertyId,
                propertyTitle: params.propertyTitle,
                checkIn: params.checkIn,
                checkOut: params.checkOut,
            },
        });
        if (params.refundAmount && params.refundAmount > 0) {
            await this.notifyRefundProcessed(params.guestId, {
                bookingId: params.bookingId,
                propertyTitle: params.propertyTitle,
                amount: params.refundAmount,
                currency: params.currency ?? 'XAF',
            });
        }
    }
    async notifyBookingCompleted(params) {
        await this.create({
            userId: params.guestId,
            type: notification_schema_1.NotificationType.BOOKING_COMPLETED,
            title: 'Your stay is complete',
            message: `We hope you enjoyed your stay at ${params.propertyTitle}!`,
            link: `/bookings/${params.bookingId}`,
            metadata: {
                bookingId: params.bookingId,
                propertyId: params.propertyId,
                propertyTitle: params.propertyTitle,
            },
        });
        await this.create({
            userId: params.hostId,
            type: notification_schema_1.NotificationType.BOOKING_COMPLETED,
            title: 'Stay completed',
            message: `${params.guestName}'s stay at ${params.propertyTitle} has ended.`,
            link: `/hosting/bookings/${params.bookingId}`,
            metadata: {
                bookingId: params.bookingId,
                propertyId: params.propertyId,
                propertyTitle: params.propertyTitle,
                guestName: params.guestName,
            },
        });
        await this.notifyReviewRequest({
            guestId: params.guestId,
            hostId: params.hostId,
            bookingId: params.bookingId,
            propertyId: params.propertyId,
            propertyTitle: params.propertyTitle,
            guestName: params.guestName,
        });
    }
    async notifyCheckInReminder(guestId, params) {
        const timeStr = params.checkInTime ? ` at ${params.checkInTime}` : '';
        await this.create({
            userId: guestId,
            type: notification_schema_1.NotificationType.BOOKING_REMINDER,
            title: 'Check-in tomorrow! 🏠',
            message: `Your stay at ${params.propertyTitle} begins tomorrow${timeStr}. ` +
                `Make sure you have the host's contact details ready.`,
            link: `/bookings/${params.bookingId}`,
            metadata: {
                bookingId: params.bookingId,
                propertyId: params.propertyId,
                propertyTitle: params.propertyTitle,
                checkIn: params.checkIn,
            },
        });
    }
    async notifyReviewRequest(params) {
        await this.create({
            userId: params.guestId,
            type: notification_schema_1.NotificationType.REVIEW_REQUEST,
            title: 'How was your stay?',
            message: `Share your experience at ${params.propertyTitle} — your review helps other travellers.`,
            link: `/bookings/${params.bookingId}/review`,
            metadata: {
                bookingId: params.bookingId,
                propertyId: params.propertyId,
                propertyTitle: params.propertyTitle,
            },
        });
        await this.create({
            userId: params.hostId,
            type: notification_schema_1.NotificationType.REVIEW_REQUEST,
            title: 'Review your guest',
            message: `How was ${params.guestName} as a guest? Leave a review to help other hosts.`,
            link: `/hosting/bookings/${params.bookingId}/review`,
            metadata: {
                bookingId: params.bookingId,
                propertyId: params.propertyId,
                propertyTitle: params.propertyTitle,
                guestName: params.guestName,
            },
        });
    }
    async notifyReviewReceived(hostId, params) {
        await this.create({
            userId: hostId,
            type: notification_schema_1.NotificationType.REVIEW_RECEIVED,
            title: `New ${params.rating}★ review on ${params.propertyTitle}`,
            message: `${params.guestName} left a review for ${params.propertyTitle}. ` +
                `It will be published once both sides have reviewed.`,
            link: `/hosting/reviews/${params.reviewId}`,
            metadata: {
                reviewId: params.reviewId,
                bookingId: params.bookingId,
                propertyId: params.propertyId,
                propertyTitle: params.propertyTitle,
                guestName: params.guestName,
            },
        });
    }
    async notifyReviewsPublished(params) {
        const sharedMeta = {
            bookingId: params.bookingId,
            propertyId: params.propertyId,
            propertyTitle: params.propertyTitle,
        };
        await Promise.all([
            this.create({
                userId: params.guestId,
                type: notification_schema_1.NotificationType.REVIEW_PUBLISHED,
                title: 'Your review is now public',
                message: `Reviews for your stay at ${params.propertyTitle} are now visible to everyone.`,
                link: `/bookings/${params.bookingId}/review`,
                metadata: sharedMeta,
            }),
            this.create({
                userId: params.hostId,
                type: notification_schema_1.NotificationType.REVIEW_PUBLISHED,
                title: 'Reviews published',
                message: `Reviews for the stay at ${params.propertyTitle} are now visible.`,
                link: `/hosting/reviews`,
                metadata: sharedMeta,
            }),
        ]);
    }
    async notifyReviewResponse(guestId, params) {
        await this.create({
            userId: guestId,
            type: notification_schema_1.NotificationType.REVIEW_RESPONSE,
            title: `${params.hostName} responded to your review`,
            message: `The host of ${params.propertyTitle} has responded to your review.`,
            link: `/reviews/${params.reviewId}`,
            metadata: {
                reviewId: params.reviewId,
                propertyId: params.propertyId,
                propertyTitle: params.propertyTitle,
            },
        });
    }
    async notifyPaymentReceived(hostId, params) {
        await this.create({
            userId: hostId,
            type: notification_schema_1.NotificationType.PAYMENT_RECEIVED,
            title: 'Payment received',
            message: `Payment of ${params.amount} ${params.currency} received for ` +
                `${params.guestName}'s booking at ${params.propertyTitle}.`,
            link: `/hosting/bookings/${params.bookingId}`,
            metadata: {
                bookingId: params.bookingId,
                propertyTitle: params.propertyTitle,
                guestName: params.guestName,
                amount: params.amount,
                currency: params.currency,
            },
        });
    }
    async notifyRefundProcessed(guestId, params) {
        await this.create({
            userId: guestId,
            type: notification_schema_1.NotificationType.REFUND_PROCESSED,
            title: 'Refund processed',
            message: `A refund of ${params.amount} ${params.currency} has been issued ` +
                `for your cancelled booking at ${params.propertyTitle}.`,
            link: `/bookings/${params.bookingId}`,
            metadata: {
                bookingId: params.bookingId,
                propertyTitle: params.propertyTitle,
                amount: params.amount,
                currency: params.currency,
            },
        });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(notification_schema_1.Notification.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        notifications_gateway_1.NotificationsGateway])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map