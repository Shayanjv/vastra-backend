import type { Request, Response } from "express";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { sendError, sendSuccess } from "../../utils/response.util";
import userService from "./user.service";

const parsePositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
};

const resolveUserId = (request: Request): string => {
  const userId = request.user?.userId;

  if (!userId) {
    throw new AppError("User context missing", 401, "AUTH_003");
  }

  return userId;
};

const handleControllerError = (
  request: Request,
  response: Response,
  error: unknown,
  fallbackMessage: string,
  endpoint: string
): Response => {
  const appError =
    error instanceof AppError ? error : new AppError("Unexpected controller error", 500, "INTERNAL_500");

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
    logger.error("User controller operation failed", logPayload);
  } else {
    logger.warn("User controller operation failed", logPayload);
  }

  return sendError(response, appError.statusCode, fallbackMessage, appError.message, appError.code);
};

export const listUserRecords = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);

    const page = parsePositiveInteger(request.query["page"], 1);
    const limit = parsePositiveInteger(request.query["limit"], 20);

    const result = await userService.list(userId, page, limit);

    return sendSuccess(
      response,
      200,
      "User records fetched successfully",
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
      "Failed to fetch user records",
      "user/list"
    );
  }
};

export const createUserRecord = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);

    const createdRecord = await userService.create(userId, {
      name: request.body.name,
      description: request.body.description,
      city: request.body.city,
      state: request.body.state,
      profile_photo_url: request.body.profile_photo_url,
      skin_tone: request.body.skin_tone,
      body_type: request.body.body_type,
      style_preferences: request.body.style_preferences
    });

    return sendSuccess(response, 201, "User record created successfully", createdRecord);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to create user record",
      "user/create"
    );
  }
};

export const getCurrentUserProfile = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const userProfile = await userService.getProfile(userId);

    return sendSuccess(response, 200, "User profile fetched successfully", userProfile);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch user profile",
      "user/profile"
    );
  }
};

export const updateCurrentUserProfile = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const updatedProfile = await userService.updateProfile(userId, request.body);

    return sendSuccess(response, 200, "User profile updated successfully", updatedProfile);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to update user profile",
      "user/profile"
    );
  }
};

export const getUserPreferences = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const preferences = await userService.getPreferences(userId);

    return sendSuccess(response, 200, "User preferences fetched successfully", preferences);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch user preferences",
      "user/preferences"
    );
  }
};

export const updateUserPreferences = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const updatedPreferences = await userService.updatePreferences(userId, request.body);

    return sendSuccess(response, 200, "User preferences updated successfully", updatedPreferences);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to update user preferences",
      "user/preferences"
    );
  }
};

export const deleteUserAccount = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const result = await userService.softDeleteAccount(userId);

    return sendSuccess(response, 200, "User account deleted successfully", result);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to delete user account",
      "user/account"
    );
  }
};

export const saveUserFcmToken = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const result = await userService.saveFcmToken(userId, request.body.fcm_token);

    return sendSuccess(response, 200, "FCM token saved successfully", result);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to save FCM token",
      "user/fcm-token"
    );
  }
};

