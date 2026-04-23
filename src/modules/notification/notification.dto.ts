import { z } from "zod";

/**
 * PAGINATION
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

/**
 * GET /api/v1/notifications
 * Fetch user notifications (all or unread only)
 */
export const getNotificationsQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional()
});

/**
 * NOTIFICATION ID PARAM
 */
export const notificationIdParamsSchema = z.object({
  id: z.string().uuid("Invalid notification ID")
});

/**
 * POST /api/v1/notifications/send
 * Send FCM push notification to specific user
 */
export const sendNotificationSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  title: z.string().min(1).max(200, "Title must be 200 characters or less"),
  body: z.string().min(1).max(1000, "Body must be 1000 characters or less"),
  type: z.string().min(1).max(50, "Type must be 50 characters or less").optional(),
  data: z.record(z.string()).optional()
});

/**
 * PUT /api/v1/notifications/:id/read
 * Mark notification as read
 */
export const markNotificationReadSchema = z.object({});
