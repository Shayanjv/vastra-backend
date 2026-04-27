import type { Request, Response } from "express";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { sendError, sendSuccess } from "../../utils/response.util";
import homeService from "./home.service";

const resolveUserId = (request: Request): string => {
  const userId = request.user?.userId;

  if (!userId) {
    throw new AppError("User context missing", 401, "AUTH_003");
  }

  return userId;
};

export const getDashboard = async (request: Request, response: Response): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    const period = typeof request.query["period"] === "string" ? request.query["period"] : "today";

    const dashboard = await homeService.getDashboard(userId, period);

    return sendSuccess(response, 200, "Dashboard fetched successfully", dashboard);
  } catch (error) {
    const appError =
      error instanceof AppError ? error : new AppError("Failed to fetch dashboard", 500, "INTERNAL_500");

    logger.warn("Get dashboard failed", {
      endpoint: "home/dashboard",
      requestId: request.requestId,
      userId: request.user?.userId,
      code: appError.code,
      error: appError.message,
      timestamp: new Date().toISOString()
    });

    return sendError(response, appError.statusCode, "Failed to fetch dashboard", appError.message, appError.code);
  }
};
