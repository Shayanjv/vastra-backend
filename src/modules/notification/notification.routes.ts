import { Router } from "express";
import { validateRequest } from "../../middleware/validate.middleware";
import {
  getNotifications,
  sendNotification,
  markAsRead,
  sendMorningOutfit
} from "./notification.controller";
import {
  getNotificationsQuerySchema,
  sendNotificationSchema,
  notificationIdParamsSchema,
  markNotificationReadSchema
} from "./notification.dto";

const notificationRoutes = Router();

/**
 * GET /api/v1/notifications
 * Get user notifications (optionally filtered to unread)
 */
notificationRoutes.get(
  "/",
  validateRequest({ query: getNotificationsQuerySchema }),
  getNotifications
);

/**
 * POST /api/v1/notifications/send
 * Send FCM notification to specific user
 */
notificationRoutes.post(
  "/send",
  validateRequest({ body: sendNotificationSchema }),
  sendNotification
);

/**
 * POST /api/v1/notifications/morning-outfit
 * Send morning outfit notification to all users
 * Can be called by cron job or admin endpoint
 */
notificationRoutes.post(
  "/morning-outfit",
  sendMorningOutfit
);

/**
 * PUT /api/v1/notifications/:id/read
 * Mark notification as read
 */
notificationRoutes.put(
  "/:id/read",
  validateRequest({ params: notificationIdParamsSchema, body: markNotificationReadSchema }),
  markAsRead
);

export default notificationRoutes;
