import type { Request, Response } from "express";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { sendError, sendSuccess } from "../../utils/response.util";
import outfitService from "./outfit.service";

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

const resolveOutfitId = (request: Request): string => {
  const outfitId = request.params["id"];

  if (typeof outfitId !== "string" || outfitId.length === 0) {
    throw new AppError("Invalid outfit id", 400, "VALIDATION_001");
  }

  return outfitId;
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
    logger.error("Outfit controller operation failed", logPayload);
  } else {
    logger.warn("Outfit controller operation failed", logPayload);
  }

  return sendError(response, appError.statusCode, fallbackMessage, appError.message, appError.code);
};

export const listOutfitRecords = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);

    const page = parsePositiveInteger(request.query["page"], 1);
    const limit = parsePositiveInteger(request.query["limit"], 20);

    const result = await outfitService.list(userId, page, limit);

    return sendSuccess(
      response,
      200,
      "Outfit records fetched successfully",
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
      "Failed to fetch outfit records",
      "outfit/legacy-list"
    );
  }
};

export const createOutfitRecord = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);

    const createdRecord = await outfitService.create(userId, {
      name: request.body.name,
      description: request.body.description
    });

    return sendSuccess(response, 201, "Outfit record created successfully", createdRecord);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to create outfit record",
      "outfit/legacy-create"
    );
  }
};

export const suggestOutfit = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const suggestion = await outfitService.suggestOutfit(userId, request.body);

    return sendSuccess(response, 201, "Outfit suggestion generated successfully", suggestion);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to generate outfit suggestion",
      "outfit/suggest"
    );
  }
};

export const getTodayOutfit = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const suggestion = await outfitService.getTodaySuggestion(userId);

    return sendSuccess(response, 200, "Today's outfit suggestion fetched successfully", suggestion);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch today's outfit suggestion",
      "outfit/today"
    );
  }
};

export const getOutfitHistory = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const page = parsePositiveInteger(request.query["page"], 1);
    const limit = parsePositiveInteger(request.query["limit"], 20);

    const history = await outfitService.getHistory(userId, page, limit, {
      occasion: parseOptionalTrimmedString(request.query["occasion"]),
      from_date: parseOptionalDate(request.query["from_date"]),
      to_date: parseOptionalDate(request.query["to_date"])
    });

    return sendSuccess(response, 200, "Outfit history fetched successfully", history.items, {
      page,
      limit,
      total: history.total
    });
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch outfit history",
      "outfit/history"
    );
  }
};

export const wearOutfit = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const outfitId = resolveOutfitId(request);
    const updatedOutfit = await outfitService.markOutfitAsWorn(userId, outfitId, request.body);

    return sendSuccess(response, 200, "Outfit marked as worn successfully", updatedOutfit);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to mark outfit as worn",
      "outfit/wear"
    );
  }
};

export const saveOutfitCombination = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const savedOutfit = await outfitService.saveOutfit(userId, request.body);

    return sendSuccess(response, 201, "Outfit combination saved successfully", savedOutfit);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to save outfit combination",
      "outfit/save"
    );
  }
};

export const getSavedOutfits = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const page = parsePositiveInteger(request.query["page"], 1);
    const limit = parsePositiveInteger(request.query["limit"], 20);
    const savedOutfits = await outfitService.getSavedOutfits(userId, page, limit);

    return sendSuccess(response, 200, "Saved outfits fetched successfully", savedOutfits.items, {
      page,
      limit,
      total: savedOutfits.total
    });
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch saved outfits",
      "outfit/saved-list"
    );
  }
};

export const deleteSavedOutfit = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const savedOutfitId = resolveOutfitId(request);
    const deletionResult = await outfitService.deleteSavedOutfit(userId, savedOutfitId);

    return sendSuccess(response, 200, "Saved outfit deleted successfully", deletionResult);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to delete saved outfit",
      "outfit/saved-delete"
    );
  }
};

