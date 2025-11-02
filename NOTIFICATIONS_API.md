# 🔔 Notifications API Documentation

## Overview
Complete notification system for HoroHouse backend API with real-time updates, multiple notification types, and full CRUD operations.

## 📁 File Structure

```
src/
└── notifications/
    ├── schemas/
    │   └── notification.schema.ts      # MongoDB schema
    ├── dto/
    │   ├── create-notification.dto.ts  # Create DTO
    │   └── query-notification.dto.ts   # Query DTO
    ├── notifications.controller.ts     # REST endpoints
    ├── notifications.service.ts        # Business logic
    └── notifications.module.ts         # Module definition
```

## 🗄️ Database Schema

### Notification Model

```typescript
{
  userId: ObjectId,              // User who receives the notification
  type: NotificationType,        // Type of notification
  title: string,                 // Notification title
  message: string,               // Notification message
  read: boolean,                 // Read status (default: false)
  link?: string,                 // Optional link to related resource
  metadata?: {                   // Optional metadata
    propertyId?: string,
    inquiryId?: string,
    senderId?: string,
    [key: string]: any
  },
  createdAt: Date,              // Auto-generated
  updatedAt: Date               // Auto-generated
}
```

### Notification Types

```typescript
enum NotificationType {
  INQUIRY = 'inquiry',                    // New inquiry on property
  FAVORITE = 'favorite',                  // Property favorited
  PROPERTY_UPDATE = 'property_update',    // Property status changed
  MESSAGE = 'message',                    // New message
  SYSTEM = 'system',                      // System notification
}
```

### Indexes

- `userId + read` - For filtering unread notifications
- `userId + createdAt` - For sorting by date
- `createdAt` - TTL index (auto-delete after 30 days)

## 🚀 API Endpoints

### Base URL
```
/api/v1/notifications
```

### Authentication
All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

### 1. Get User Notifications

**GET** `/api/v1/notifications`

Get paginated list of user's notifications.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 20 | Number of notifications per page |
| skip | number | 0 | Number of notifications to skip |
| unreadOnly | boolean | false | Filter only unread notifications |

#### Response

```json
{
  "notifications": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "507f1f77bcf86cd799439012",
      "type": "inquiry",
      "title": "New inquiry on your property",
      "message": "John Doe sent an inquiry about Modern Apartment",
      "read": false,
      "link": "/dashboard/inquiries/507f1f77bcf86cd799439013",
      "metadata": {
        "propertyId": "507f1f77bcf86cd799439014",
        "inquiryId": "507f1f77bcf86cd799439013"
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "unreadCount": 5,
  "total": 20
}
```

#### Example Request

```bash
curl -X GET "http://localhost:4000/api/v1/notifications?limit=10&unreadOnly=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 2. Get Unread Count

**GET** `/api/v1/notifications/unread-count`

Get count of unread notifications.

#### Response

```json
{
  "count": 5
}
```

#### Example Request

```bash
curl -X GET "http://localhost:4000/api/v1/notifications/unread-count" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 3. Mark Notification as Read

**PATCH** `/api/v1/notifications/:id/read`

Mark a single notification as read.

#### Parameters

| Parameter | Type | Location | Description |
|-----------|------|----------|-------------|
| id | string | path | Notification ID |

#### Response

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "userId": "507f1f77bcf86cd799439012",
  "type": "inquiry",
  "title": "New inquiry on your property",
  "message": "John Doe sent an inquiry about Modern Apartment",
  "read": true,
  "link": "/dashboard/inquiries/507f1f77bcf86cd799439013",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:35:00.000Z"
}
```

#### Example Request

```bash
curl -X PATCH "http://localhost:4000/api/v1/notifications/507f1f77bcf86cd799439011/read" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 4. Mark All as Read

**PATCH** `/api/v1/notifications/read-all`

Mark all user's notifications as read.

#### Response

```json
{
  "modifiedCount": 5
}
```

#### Example Request

```bash
curl -X PATCH "http://localhost:4000/api/v1/notifications/read-all" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 5. Delete Notification

**DELETE** `/api/v1/notifications/:id`

Delete a single notification.

#### Parameters

| Parameter | Type | Location | Description |
|-----------|------|----------|-------------|
| id | string | path | Notification ID |

#### Response

```
204 No Content
```

#### Example Request

```bash
curl -X DELETE "http://localhost:4000/api/v1/notifications/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 6. Delete All Read Notifications

**DELETE** `/api/v1/notifications/read`

Delete all read notifications for the user.

#### Response

```json
{
  "deletedCount": 10
}
```

#### Example Request

```bash
curl -X DELETE "http://localhost:4000/api/v1/notifications/read" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🔧 Service Methods

### NotificationsService

#### create(createNotificationDto)
Create a new notification.

```typescript
await notificationsService.create({
  userId: '507f1f77bcf86cd799439012',
  type: NotificationType.INQUIRY,
  title: 'New inquiry',
  message: 'John sent an inquiry',
  link: '/dashboard/inquiries/123',
  metadata: { propertyId: '456', inquiryId: '123' }
});
```

#### createBulk(userIds, notificationData)
Create notifications for multiple users.

```typescript
await notificationsService.createBulk(
  ['user1', 'user2', 'user3'],
  {
    type: NotificationType.SYSTEM,
    title: 'System Update',
    message: 'New features available'
  }
);
```

#### Helper Methods

##### createInquiryNotification
```typescript
await notificationsService.createInquiryNotification(
  propertyOwnerId,
  inquiryId,
  propertyId,
  senderName,
  propertyTitle
);
```

##### createFavoriteNotification
```typescript
await notificationsService.createFavoriteNotification(
  propertyOwnerId,
  propertyId,
  userName,
  propertyTitle
);
```

##### createPropertyUpdateNotification
```typescript
await notificationsService.createPropertyUpdateNotification(
  userId,
  propertyId,
  propertyTitle,
  'approved' // updateType
);
```

---

## 🔗 Integration Examples

### 1. Inquiry Created

When a user sends an inquiry, automatically create notification for property owner:

```typescript
// In inquiry.service.ts
async create(createInquiryDto: CreateInquiryDto, user: User) {
  // ... create inquiry logic ...
  
  // Create notification
  await this.notificationsService.createInquiryNotification(
    agentId.toString(),
    savedInquiry._id.toString(),
    property._id.toString(),
    user.name,
    property.title
  );
}
```

### 2. Property Favorited

When a user favorites a property:

```typescript
// In users.service.ts
async addToFavorites(userId: string, propertyId: string) {
  // ... add to favorites logic ...
  
  // Get property and user details
  const property = await this.propertyModel.findById(propertyId);
  const user = await this.userModel.findById(userId);
  
  // Create notification for property owner
  await this.notificationsService.createFavoriteNotification(
    property.ownerId.toString(),
    propertyId,
    user.name,
    property.title
  );
}
```

### 3. Property Status Updated

When property status changes:

```typescript
// In properties.service.ts
async updatePropertyStatus(propertyId: string, status: string) {
  // ... update property logic ...
  
  // Notify property owner
  await this.notificationsService.createPropertyUpdateNotification(
    property.ownerId.toString(),
    propertyId,
    property.title,
    status
  );
}
```

---

## 🧪 Testing

### Test Notification Creation

```bash
# Create test notification (admin only)
curl -X POST "http://localhost:4000/api/v1/notifications" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "507f1f77bcf86cd799439012",
    "type": "system",
    "title": "Test Notification",
    "message": "This is a test notification"
  }'
```

### Test Get Notifications

```bash
# Get all notifications
curl -X GET "http://localhost:4000/api/v1/notifications" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get only unread
curl -X GET "http://localhost:4000/api/v1/notifications?unreadOnly=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🚀 Deployment

### Environment Variables

No additional environment variables required. Uses existing MongoDB connection.

### Database Migrations

No migrations needed. Schema will be created automatically on first use.

### Indexes

Indexes are created automatically via schema definition:

```typescript
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
```

---

## 📊 Performance Considerations

### Indexes
- Compound index on `userId + read` for fast unread queries
- Index on `userId + createdAt` for sorting
- TTL index auto-deletes old notifications (30 days)

### Pagination
- Default limit: 20 notifications
- Use `skip` and `limit` for pagination
- Total count included in response

### Auto-Cleanup
- Notifications older than 30 days are automatically deleted
- Configurable via TTL index

---

## 🔮 Future Enhancements

### WebSocket Integration

Add real-time notifications:

```typescript
// In notifications.service.ts
async create(dto: CreateNotificationDto) {
  const notification = await this.notificationModel.create(dto);
  
  // Emit via WebSocket
  this.socketGateway.emitToUser(dto.userId, 'notification', notification);
  
  return notification;
}
```

### Push Notifications

Integrate with Firebase Cloud Messaging:

```typescript
async create(dto: CreateNotificationDto) {
  const notification = await this.notificationModel.create(dto);
  
  // Send push notification
  await this.fcmService.sendToUser(dto.userId, {
    title: dto.title,
    body: dto.message,
    data: { notificationId: notification._id }
  });
  
  return notification;
}
```

### Email Notifications

Send email for important notifications:

```typescript
async create(dto: CreateNotificationDto) {
  const notification = await this.notificationModel.create(dto);
  
  // Send email for important types
  if (dto.type === NotificationType.INQUIRY) {
    await this.emailService.sendInquiryNotification(dto.userId, notification);
  }
  
  return notification;
}
```

---

## ✅ Checklist

- [x] Notification schema created
- [x] CRUD endpoints implemented
- [x] Service methods created
- [x] Module registered in app
- [x] Integrated with inquiry service
- [x] Indexes configured
- [x] TTL auto-cleanup enabled
- [ ] WebSocket integration (future)
- [ ] Push notifications (future)
- [ ] Email notifications (future)

---

## 🎉 Success!

Your notification system is now fully implemented on the backend! The API is ready to:

✅ Create notifications automatically  
✅ Fetch notifications with pagination  
✅ Mark as read (single/all)  
✅ Delete notifications  
✅ Auto-cleanup old notifications  
✅ Integrate with other services  

**Next Steps:**
1. Test all endpoints
2. Monitor notification creation
3. Consider adding WebSocket for real-time updates
4. Add push notifications for mobile
