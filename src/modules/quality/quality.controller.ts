import type { Request, Response } from "express";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { sendError, sendSuccess } from "../../utils/response.util";
import qualityService from "./quality.service";

/**
 * Helper to resolve user ID from request
 */
const resolveUserId = (request: Request): string => {
  const userId = request.user?.userId;

  if (!userId) {
    throw new AppError("User context missing", 401, "AUTH_003");
  }

  return userId;
};

/**
 * Helper to handle controller errors with logging
 */
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
    logger.error("Quality controller operation failed", logPayload);
  } else {
    logger.warn("Quality controller operation failed", logPayload);
  }

  return sendError(response, appError.statusCode, fallbackMessage, appError.message, appError.code);
};

/**
 * GET /api/v1/quality/:clothId
 * Get current quality score with prediction and advice
 */
export const getQualityScore = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const clothId = request.params["clothId"];
    const includeAdvice = (request.query["includeAdvice"] as string) === "false" ? false : true;

    if (!clothId) {
      throw new AppError("Invalid cloth ID", 400, "VALIDATION_001");
    }

    const qualityScore = await qualityService.getQualityScore(userId, clothId, includeAdvice);

    return sendSuccess(
      response,
      200,
      "Quality score fetched successfully",
      qualityScore
    );
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch quality score",
      "quality/get-score"
    );
  }
};

/**
 * GET /api/v1/quality/alerts
 * Get all clothes below 40% quality
 */
export const getAlerts = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const pageStr = request.query["page"] as string | undefined;
    const limitStr = request.query["limit"] as string | undefined;
    const page = pageStr ? Number.parseInt(pageStr, 10) : 1;
    const limit = limitStr ? Number.parseInt(limitStr, 10) : 20;

    const result = await qualityService.getAlerts(userId, page, limit);

    return sendSuccess(
      response,
      200,
      "Quality alerts fetched successfully",
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
      "Failed to fetch quality alerts",
      "quality/get-alerts"
    );
  }
};

/**
 * GET /api/v1/quality/best-preserved
 * Get top preserved clothes
 */
export const getBestPreserved = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const limitStr = request.query["limit"] as string | undefined;
    const limit = limitStr ? Number.parseInt(limitStr, 10) : 3;

    const bestPreserved = await qualityService.getBestPreserved(userId, limit);

    return sendSuccess(
      response,
      200,
      "Best preserved clothes fetched successfully",
      bestPreserved
    );
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch best preserved clothes",
      "quality/best-preserved"
    );
  }
};

/**
 * GET /api/v1/quality/history/:clothId
 * Get quality history for charting
 */
export const getHistory = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const clothId = request.params["clothId"];
    const daysBackStr = request.query["daysBack"] as string | undefined;
    const limitStr = request.query["limit"] as string | undefined;
    const daysBack = daysBackStr ? Number.parseInt(daysBackStr, 10) : 90;
    const limit = limitStr ? Number.parseInt(limitStr, 10) : 100;

    if (!clothId) {
      throw new AppError("Invalid cloth ID", 400, "VALIDATION_001");
    }

    const history = await qualityService.getHistory(userId, clothId, daysBack, limit);

    return sendSuccess(
      response,
      200,
      "Quality history fetched successfully",
      history
    );
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch quality history",
      "quality/get-history"
    );
  }
};

/**
 * POST /api/v1/quality/record
 * Manually record a quality check
 */
export const recordManualQuality = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);

    const recordedQuality = await qualityService.recordManualQuality(userId, {
      cloth_id: request.body.cloth_id,
      quality_score: request.body.quality_score,
      notes: request.body.notes
    });

    return sendSuccess(
      response,
      201,
      "Quality record created successfully",
      recordedQuality
    );
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to record quality check",
      "quality/record-manual"
    );
  }
};
