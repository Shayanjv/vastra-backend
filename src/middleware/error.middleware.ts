import type { NextFunction, Request, Response } from "express";
import environment from "../config/environment";
import { AppError } from "../utils/error.util";
import logger from "../utils/logger.util";
import { sendError } from "../utils/response.util";

export const notFoundHandler = (request: Request, response: Response): Response => {
  return sendError(
    response,
    404,
    "Route not found",
    `Cannot ${request.method} ${request.originalUrl}`,
    "ROUTE_404"
  );
};

export const errorHandler = (
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction
): Response => {
  if (response.headersSent) {
    return response;
  }

  let statusCode = 500;
  let code = "INTERNAL_500";
  let message = "Internal server error";
  let errorDetail = "Unexpected runtime error";

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    errorDetail = error.message;
  } else if (error instanceof Error) {
    errorDetail = error.message;
  }

  logger.error("Request failed", {
    endpoint: request.originalUrl,
    method: request.method,
    requestId: request.requestId,
    error: errorDetail,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString()
  });

  const safeErrorDetail =
    environment.NODE_ENV === "production" && statusCode >= 500
      ? "An unexpected error occurred"
      : errorDetail;

  return sendError(response, statusCode, message, safeErrorDetail, code);
};
