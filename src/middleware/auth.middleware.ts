import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/error.util";
import logger from "../utils/logger.util";
import { verifyAccessToken } from "../utils/jwt.util";
import { sendError } from "../utils/response.util";

export const requireAuth = (
  request: Request,
  response: Response,
  next: NextFunction
): Response | void => {
  try {
    const authorization = request.headers.authorization;

    if (!authorization) {
      logger.warn("Authentication failed", {
        endpoint: request.originalUrl,
        method: request.method,
        requestId: request.requestId,
        code: "AUTH_003",
        reason: "Authorization header is required",
        timestamp: new Date().toISOString()
      });

      return sendError(
        response,
        401,
        "Unauthorized",
        "Authorization header is required",
        "AUTH_003"
      );
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      logger.warn("Authentication failed", {
        endpoint: request.originalUrl,
        method: request.method,
        requestId: request.requestId,
        code: "AUTH_003",
        reason: "Authorization header must be in Bearer token format",
        timestamp: new Date().toISOString()
      });

      return sendError(
        response,
        401,
        "Unauthorized",
        "Authorization header must be in Bearer token format",
        "AUTH_003"
      );
    }

    const decodedToken = verifyAccessToken(token);
    request.user = decodedToken;

    next();
  } catch (error) {
    const appError =
      error instanceof AppError ? error : new AppError("Unauthorized", 401, "AUTH_003");

    logger.warn("Authentication failed", {
      endpoint: request.originalUrl,
      method: request.method,
      requestId: request.requestId,
      code: appError.code,
      timestamp: new Date().toISOString()
    });

    return sendError(response, appError.statusCode, "Unauthorized", appError.message, appError.code);
  }
};

export const requirePremium = (
  request: Request,
  response: Response,
  next: NextFunction
): Response | void => {
  if (!request.user) {
    return sendError(
      response,
      401,
      "Unauthorized",
      "Authenticated user context is missing",
      "AUTH_003"
    );
  }

  if (request.user.tier !== "PREMIUM") {
    return sendError(
      response,
      403,
      "Premium subscription required",
      "This route is available only for premium users",
      "AUTH_003"
    );
  }

  next();
};
