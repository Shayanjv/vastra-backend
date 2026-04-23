import type { Request, Response } from "express";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { sendError, sendSuccess } from "../../utils/response.util";
import clothService from "./cloth.service";

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

const parseOptionalTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const resolveUserId = (request: Request): string => {
  const userId = request.user?.userId;

  if (!userId) {
    throw new AppError("User context missing", 401, "AUTH_003");
  }

  return userId;
};

const resolveClothId = (request: Request): string => {
  const clothId = request.params["id"];

  if (typeof clothId !== "string" || clothId.length === 0) {
    throw new AppError("Invalid cloth id", 400, "VALIDATION_001");
  }

  return clothId;
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
    logger.error("Cloth controller operation failed", logPayload);
  } else {
    logger.warn("Cloth controller operation failed", logPayload);
  }

  return sendError(response, appError.statusCode, fallbackMessage, appError.message, appError.code);
};

export const listClothRecords = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);

    const page = parsePositiveInteger(request.query["page"], 1);
    const limit = parsePositiveInteger(request.query["limit"], 20);

    const result = await clothService.list(userId, page, limit, {
      category: parseOptionalTrimmedString(request.query["category"]),
      occasion: parseOptionalTrimmedString(request.query["occasion"]),
      season: parseOptionalTrimmedString(request.query["season"]),
      search: parseOptionalTrimmedString(request.query["search"])
    });

    return sendSuccess(
      response,
      200,
      "Cloth records fetched successfully",
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
      "Failed to fetch cloth records",
      "cloth/list"
    );
  }
};

export const createClothRecord = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const createdRecord = await clothService.create(userId, request.body);

    return sendSuccess(response, 201, "Cloth record created successfully", createdRecord);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to create cloth record",
      "cloth/create"
    );
  }
};

export const getClothRecord = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const clothId = resolveClothId(request);
    const cloth = await clothService.getById(userId, clothId);

    return sendSuccess(response, 200, "Cloth details fetched successfully", cloth);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch cloth details",
      "cloth/get"
    );
  }
};

export const updateClothRecord = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const clothId = resolveClothId(request);
    const cloth = await clothService.update(userId, clothId, request.body);

    return sendSuccess(response, 200, "Cloth updated successfully", cloth);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to update cloth",
      "cloth/update"
    );
  }
};

export const deleteClothRecord = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const clothId = resolveClothId(request);
    const result = await clothService.softDelete(userId, clothId);

    return sendSuccess(response, 200, "Cloth deleted successfully", result);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to delete cloth",
      "cloth/delete"
    );
  }
};

export const recordClothWear = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const clothId = resolveClothId(request);
    const cloth = await clothService.recordWear(userId, clothId, request.body);

    return sendSuccess(response, 200, "Cloth wear recorded successfully", cloth);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to record cloth wear",
      "cloth/wear"
    );
  }
};

export const recordClothWash = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const clothId = resolveClothId(request);
    const cloth = await clothService.recordWash(userId, clothId, request.body);

    return sendSuccess(response, 200, "Cloth wash recorded successfully", cloth);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to record cloth wash",
      "cloth/wash"
    );
  }
};

export const getClothStats = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const stats = await clothService.getStats(userId);

    return sendSuccess(response, 200, "Cloth stats fetched successfully", stats);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch cloth stats",
      "cloth/stats"
    );
  }
};

