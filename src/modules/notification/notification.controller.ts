import type { Request, Response } from "express";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { sendError, sendSuccess } from "../../utils/response.util";
import notificationService from "./notification.service";

/**
 * Helper to resolve user ID
 */
const resolveUserId = (request: Request): string => {
  const userId = request.user?.userId;

  if (!userId) {
    throw new AppError("User context missing", 401, "AUTH_003");
  }

  return userId;
};

/**
 * Helper to handle controller errors
 */
const handleControllerError = (
  request: Request,
  response: Response,
  error: unknown,
  fallbackMessage: string,
  endpoint: string
): Response => {
  const appError =
    error instanceof AppError ? error : new AppError("Unexpected error", 500, "INTERNAL_500");

  const logPayload = {
    endpoint,
    method: request.method,
    requestId: request.requestId,
    userId: request.user?.userId,
    code: appError.code,
    statusCode: appError.statusCode,
    error: appError.message,
    timestamp: new Date().toISOString()
  };

  if (appError.statusCode >= 500) {
    logger.error("Notification operation failed", logPayload);
  } else {
    logger.warn("Notification operation failed", logPayload);
  }

  return sendError(response, appError.statusCode, fallbackMessage, appError.message, appError.code);
};

/**
 * GET /api/v1/notifications
 * Get user notifications (optionally unread only)
 */
export const getNotifications = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const pageStr = request.query["page"] as string | undefined;
    const limitStr = request.query["limit"] as string | undefined;
    const unreadOnlyStr = request.query["unreadOnly"] as string | undefined;

    const page = pageStr ? Number.parseInt(pageStr, 10) : 1;
    const limit = limitStr ? Number.parseInt(limitStr, 10) : 20;
    const unreadOnly = unreadOnlyStr === "true";

    const result = await notificationService.getUserNotifications(userId, page, limit, unreadOnly);

    return sendSuccess(
      response,
      200,
      "Notifications fetched successfully",
      result.items,
      {
        page,
        limit,
        total: result.total
      }
    );
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch notifications",
      "notification/get-notifications"
    );
  }
};

/**
 * POST /api/v1/notifications/send
 * Send FCM notification to specific user
 */
export const sendNotification = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    // Note: This endpoint allows any authenticated user to send notifications
    // In production, you may want to restrict this to admins or service accounts
    resolveUserId(request);

    const notification = await notificationService.sendNotification({
      user_id: request.body.user_id,
      title: request.body.title,
      body: request.body.body,
      type: request.body.type,
      data: request.body.data
    });

    logger.info("Notification sent", {
      notificationId: notification.id,
      userId: notification.user_id
    });

    return sendSuccess(response, 201, "Notification sent successfully", notification);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to send notification",
      "notification/send"
    );
  }
};

/**
 * PUT /api/v1/notifications/:id/read
 * Mark notification as read
 */
export const markAsRead = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const notificationId = request.params["id"];

    if (!notificationId) {
      throw new AppError("Invalid notification ID", 400, "VALIDATION_001");
    }

    const notification = await notificationService.markAsRead(userId, notificationId);

    return sendSuccess(response, 200, "Notification marked as read", notification);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to mark notification as read",
      "notification/mark-read"
    );
  }
};

/**
 * POST /api/v1/notifications/morning-outfit
 * Send morning outfit notification to all users
 * Admin/scheduled task endpoint
 */
export const sendMorningOutfit = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    // In production, verify this is called from authorized source (cron, admin, etc.)
    const result = await notificationService.sendMorningOutfitNotifications();

    logger.info("Morning outfit notifications sent", result);

    return sendSuccess(response, 200, "Morning outfit notifications sent", result);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to send morning outfit notifications",
      "notification/morning-outfit"
    );
  }
};
