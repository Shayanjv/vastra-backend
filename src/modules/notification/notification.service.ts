import { Prisma } from "@prisma/client";
import admin from "../../config/firebase";
import prisma from "../../config/database";
import logger from "../../utils/logger.util";
import { AppError } from "../../utils/error.util";

const notificationSelect = {
  id: true,
  user_id: true,
  title: true,
  body: true,
  type: true,
  is_read: true,
  data: true,
  is_deleted: true,
  created_at: true
} as const;

type PersistedNotification = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

export interface NotificationData {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string | null;
  is_read: boolean;
  data: unknown;
  created_at: string;
}

export interface SendNotificationInput {
  user_id: string;
  title: string;
  body: string;
  type?: string;
  data?: Record<string, string>;
}

export interface SendToAllInput {
  title: string;
  body: string;
  type?: string;
  data?: Record<string, string>;
}

class NotificationService {
  private toNotificationData(notification: PersistedNotification): NotificationData {
    return {
      id: notification.id,
      user_id: notification.user_id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      is_read: notification.is_read,
      data: notification.data,
      created_at: notification.created_at.toISOString()
    };
  }

  /**
   * Get user notifications (optionally filtered to unread only)
   */
  public async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<{ items: NotificationData[]; total: number }> {
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      user_id: userId,
      is_deleted: false
    };

    if (unreadOnly) {
      where.is_read = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: {
          created_at: "desc"
        },
        skip,
        take: limit
      }),
      prisma.notification.count({ where })
    ]);

    return {
      items: notifications.map((n) => this.toNotificationData(n)),
      total
    };
  }

  /**
   * Send FCM notification to specific user
   */
  public async sendNotification(input: SendNotificationInput): Promise<NotificationData> {
    try {
      // Verify user exists and has FCM token
      const user = await prisma.user.findFirst({
        where: {
          id: input.user_id,
          is_deleted: false,
          is_active: true
        },
        select: {
          id: true,
          fcm_token: true
        }
      });

      if (!user) {
        throw new AppError("User not found", 404, "USER_001");
      }

      const notificationType = input.type ?? "GENERAL";

      // Create notification record in DB
      const notification = await prisma.notification.create({
        data: {
          user_id: input.user_id,
          title: input.title,
          body: input.body,
          type: notificationType,
          data: input.data
        },
        select: notificationSelect
      });

      // Send FCM if token exists
      if (user.fcm_token) {
        try {
          await admin.messaging().send({
            notification: {
              title: input.title,
              body: input.body
            },
            data: input.data,
            token: user.fcm_token
          });

          logger.info("FCM notification sent", {
            userId: input.user_id,
            notificationId: notification.id
          });
        } catch (fcmError) {
          logger.warn("FCM send failed but notification record created", {
            userId: input.user_id,
            error: fcmError instanceof Error ? fcmError.message : "Unknown FCM error"
          });
          // Continue - notification is still saved in DB
        }
      }

      return this.toNotificationData(notification);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error("Send notification failed", {
        userId: input.user_id,
        error: error instanceof Error ? error.message : "Unknown error"
      });

      throw new AppError("Failed to send notification", 500, "INTERNAL_500");
    }
  }

  /**
   * Send notification to all users with FCM tokens
   */
  public async sendToAllUsers(input: SendToAllInput): Promise<{ sentCount: number; failedCount: number }> {
    try {
      const notificationType = input.type ?? "GENERAL";

      // Get all users with FCM tokens
      const users = await prisma.user.findMany({
        where: {
          fcm_token: {
            not: null
          },
          is_deleted: false,
          is_active: true
        },
        select: {
          id: true,
          fcm_token: true
        }
      });

      if (users.length === 0) {
        logger.info("No users with FCM tokens found");
        return { sentCount: 0, failedCount: 0 };
      }

      let sentCount = 0;
      let failedCount = 0;

      // Create notification records for all users
      await prisma.notification.createMany({
        data: users.map((user) => ({
          user_id: user.id,
          title: input.title,
          body: input.body,
          type: notificationType,
          data: input.data
        }))
      });

      // Send FCM to each user
      for (const user of users) {
        try {
          await admin.messaging().send({
            notification: {
              title: input.title,
              body: input.body
            },
            data: input.data,
            token: user.fcm_token!
          });

          sentCount++;
        } catch (error) {
          failedCount++;
          logger.warn("FCM send failed for user", {
            userId: user.id,
            error: error instanceof Error ? error.message : "Unknown FCM error"
          });
        }
      }

      logger.info("Batch FCM sent", { sentCount, failedCount, totalUsers: users.length });

      return { sentCount, failedCount };
    } catch (error) {
      logger.error("Send to all users failed", {
        error: error instanceof Error ? error.message : "Unknown error"
      });

      throw new AppError("Failed to send notifications to all users", 500, "INTERNAL_500");
    }
  }

  /**
   * Mark notification as read
   */
  public async markAsRead(userId: string, notificationId: string): Promise<NotificationData> {
    try {
      // Verify notification belongs to user
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          user_id: userId,
          is_deleted: false
        },
        select: notificationSelect
      });

      if (!notification) {
        throw new AppError("Notification not found", 404, "INTERNAL_500");
      }

      // Mark as read
      const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: { is_read: true },
        select: notificationSelect
      });

      logger.debug("Notification marked as read", {
        userId,
        notificationId
      });

      return this.toNotificationData(updated);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error("Mark as read failed", {
        userId,
        notificationId,
        error: error instanceof Error ? error.message : "Unknown error"
      });

      throw new AppError("Failed to mark notification as read", 500, "INTERNAL_500");
    }
  }

  /**
   * Send morning outfit notification
   * This is called by a scheduled task to send today's outfit to all active users
   */
  public async sendMorningOutfitNotifications(): Promise<{ sentCount: number }> {
    try {
      // This would be called by a scheduled job/cron
      // For now, send to all users with FCM tokens
      const result = await this.sendToAllUsers({
        title: "Good Morning! ☀️",
        body: "Check out today's outfit suggestion tailored just for you",
        type: "MORNING_OUTFIT",
        data: {
          action: "open_outfit_suggestion"
        }
      });

      return { sentCount: result.sentCount };
    } catch (error) {
      logger.error("Morning outfit notification failed", {
        error: error instanceof Error ? error.message : "Unknown error"
      });

      throw error;
    }
  }
}

const notificationService = new NotificationService();

export default notificationService;
