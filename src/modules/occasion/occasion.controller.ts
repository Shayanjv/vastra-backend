import type { Request, Response } from "express";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { sendError, sendSuccess } from "../../utils/response.util";
import occasionService from "./occasion.service";

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
    logger.error("Occasion controller operation failed", logPayload);
  } else {
    logger.warn("Occasion controller operation failed", logPayload);
  }

  return sendError(response, appError.statusCode, fallbackMessage, appError.message, appError.code);
};

export const listOccasionRecords = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);

    const page = parsePositiveInteger(request.query["page"], 1);
    const limit = parsePositiveInteger(request.query["limit"], 20);

    const result = await occasionService.list(userId, page, limit);

    return sendSuccess(
      response,
      200,
      "Occasion records fetched successfully",
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
      "Failed to fetch occasion records",
      "occasion/legacy-list"
    );
  }
};

export const createOccasionRecord = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);

    const createdRecord = await occasionService.create(userId, {
      name: request.body.name,
      description: request.body.description
    });

    return sendSuccess(response, 201, "Occasion record created successfully", createdRecord);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to create occasion record",
      "occasion/legacy-create"
    );
  }
};

export const getOccasionsList = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const search = parseOptionalTrimmedString(request.query["search"]);
    const occasions = await occasionService.getOccasions(userId, search);

    return sendSuccess(response, 200, "Occasions fetched successfully", occasions);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch occasions",
      "occasion/list"
    );
  }
};

export const createOccasionEntry = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const createdOccasion = await occasionService.createOccasion(userId, request.body);

    return sendSuccess(response, 201, "Occasion created successfully", createdOccasion);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to create occasion",
      "occasion/create"
    );
  }
};

export const getOccasionHistory = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const page = parsePositiveInteger(request.query["page"], 1);
    const limit = parsePositiveInteger(request.query["limit"], 20);
    const history = await occasionService.getOccasionHistory(userId, page, limit, {
      occasion_type: parseOptionalTrimmedString(request.query["occasion_type"]),
      from_date: parseOptionalDate(request.query["from_date"]),
      to_date: parseOptionalDate(request.query["to_date"])
    });

    return sendSuccess(response, 200, "Occasion history fetched successfully", history.items, {
      page,
      limit,
      total: history.total
    });
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch occasion history",
      "occasion/history"
    );
  }
};

