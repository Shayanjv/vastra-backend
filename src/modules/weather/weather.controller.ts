import type { Request, Response } from "express";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { sendError, sendSuccess } from "../../utils/response.util";
import weatherService from "./weather.service";

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
    code: appError.code,
    statusCode: appError.statusCode,
    error: appError.message,
    timestamp: new Date().toISOString()
  };

  if (appError.statusCode >= 500) {
    logger.error("Weather operation failed", logPayload);
  } else {
    logger.warn("Weather operation failed", logPayload);
  }

  return sendError(response, appError.statusCode, fallbackMessage, appError.message, appError.code);
};

/**
 * GET /api/v1/weather/:city
 * Get weather for city
 */
export const getWeather = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const city = request.params["city"];

    if (!city) {
      throw new AppError("City name is required", 400, "VALIDATION_001");
    }

    const weather = await weatherService.getWeather(city);

    logger.info("Weather fetched", {
      city,
      temperature: weather.temperature,
      condition: weather.condition
    });

    return sendSuccess(response, 200, `Weather for ${weather.city} fetched successfully`, weather);
  } catch (error) {
    return handleControllerError(
      request,
      response,
      error,
      "Failed to fetch weather",
      "weather/get-weather"
    );
  }
};
