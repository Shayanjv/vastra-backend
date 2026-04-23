import type { Request, Response } from "express";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { sendError, sendSuccess } from "../../utils/response.util";
import laundryService from "./laundry.service";

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

const parseOptionalDate = (value: unknown): Date | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return undefined;
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  return parsedDate;
};

const parseOptionalBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return fallback;
};

const resolveUserId = (request: Request): string => {
  const userId = request.user?.userId;

  if (!userId) {
    throw new AppError("User context missing", 401, "AUTH_003");
  }

  return userId;
};

const resolveFabricType = (request: Request): string => {
  const fabricType = request.params["fabricType"];

  if (typeof fabricType !== "string" || fabricType.trim().length === 0) {
    throw new AppError("Invalid fabric type", 400, "VALIDATION_001");
  }

  return fabricType;
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
    logger.error("Laundry controller operation failed", logPayload);
  } else {
    logger.warn("Laundry controller operation failed", logPayload);
  }

  return sendError(response, appError.statusCode, fallbackMessage, appError.message, appError.code);
};

export const listLaundryRecords = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);

    const page = parsePositiveInteger(request.query["page"], 1);
    const limit = parsePositiveInteger(request.query["limit"], 20);

    const result = await laundryService.list(userId, page, limit);

    return sendSuccess(
      response,
      200,
      "Laundry records fetched successfully",
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
      "Failed to fetch laundry records",
      "laundry/legacy-list"
    );
  }
};

export const createLaundryRecord = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);

    const createdRecord = await laundryService.create(userId, {
      name: request.body.name,
      description: request.body.description
    });

    return sendSuccess(response, 201, "Laundry record created successfully", createdRecord);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to create laundry record",
      "laundry/legacy-create"
    );
  }
};

export const getLaundryQueue = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const includeSoon = parseOptionalBoolean(request.query["include_soon"], true);
    const queueItems = await laundryService.getQueue(userId, includeSoon);

    return sendSuccess(response, 200, "Laundry queue fetched successfully", queueItems, {
      page: 1,
      limit: queueItems.length,
      total: queueItems.length
    });
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch laundry queue",
      "laundry/queue"
    );
  }
};

export const markLaundryAsWashed = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const updatedCloth = await laundryService.markWashed(userId, request.body);

    return sendSuccess(response, 200, "Cloth marked as washed successfully", updatedCloth);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to mark cloth as washed",
      "laundry/mark-washed"
    );
  }
};

export const getLaundryHistory = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const page = parsePositiveInteger(request.query["page"], 1);
    const limit = parsePositiveInteger(request.query["limit"], 20);

    const history = await laundryService.getHistory(userId, page, limit, {
      cloth_id: parseOptionalTrimmedString(request.query["cloth_id"]),
      from_date: parseOptionalDate(request.query["from_date"]),
      to_date: parseOptionalDate(request.query["to_date"])
    });

    return sendSuccess(response, 200, "Laundry history fetched successfully", history.items, {
      page,
      limit,
      total: history.total
    });
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch laundry history",
      "laundry/history"
    );
  }
};

export const getLaundryStats = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const includeSoon = parseOptionalBoolean(request.query["include_soon"], true);
    const stats = await laundryService.getStats(userId, includeSoon);

    return sendSuccess(response, 200, "Laundry stats fetched successfully", stats);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch laundry stats",
      "laundry/stats"
    );
  }
};

export const getLaundryTips = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const fabricType = resolveFabricType(request);
    const tips = await laundryService.getFabricTips(userId, fabricType);

    return sendSuccess(response, 200, "Laundry care tips fetched successfully", tips);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch laundry tips",
      "laundry/tips"
    );
  }
};

