import type { Request, Response } from "express";
import environment from "../../config/environment";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { sendError, sendSuccess } from "../../utils/response.util";
import authService from "./auth.service";
import userService from "../user/user.service";

const getCookieValue = (cookieHeader: string | undefined, key: string): string | null => {
  if (!cookieHeader) {
    return null;
  }

  const cookieSegments = cookieHeader.split(";");

  for (const segment of cookieSegments) {
    const [cookieKey, cookieValue] = segment.trim().split("=");

    if (cookieKey === key && typeof cookieValue === "string" && cookieValue.length > 0) {
      return cookieValue;
    }
  }

  return null;
};

const clearRefreshCookie = (response: Response): void => {
  response.cookie("refreshToken", "", {
    httpOnly: true,
    secure: environment.NODE_ENV === "production",
    sameSite: "strict",
    expires: new Date(0)
  });
};

const getBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || typeof token !== "string" || token.trim().length === 0) {
    return null;
  }

  return token;
};

const getRefreshTokenFromRequest = (request: Request): string | null => {
  const cookieToken = getCookieValue(request.headers.cookie, "refreshToken");
  const bodyToken = typeof request.body.refreshToken === "string" ? request.body.refreshToken : null;
  const bearerToken = getBearerToken(request.headers.authorization);

  return bodyToken ?? cookieToken ?? bearerToken;
};

const resolveUserId = (request: Request): string => {
  const userId = request.user?.userId;
  if (!userId) {
    throw new AppError("User context missing", 401, "AUTH_003");
  }
  return userId;
};

export const firebaseVerify = async (request: Request, response: Response): Promise<Response> => {
  try {
    const loginResult = await authService.firebaseVerify(request.body.idToken);

    response.cookie("refreshToken", loginResult.refreshToken, {
      httpOnly: true,
      secure: environment.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return sendSuccess(
      response,
      200,
      "Firebase token verified successfully",
      {
        accessToken: loginResult.accessToken,
        user: loginResult.user,
        isNewUser: loginResult.isNewUser
      }
    );
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : new AppError("Firebase verification failed", 500, "INTERNAL_500");

    logger.warn("Firebase verify controller failure", {
      endpoint: "auth/firebase-verify",
      requestId: request.requestId,
      error: appError.message,
      timestamp: new Date().toISOString()
    });

    return sendError(
      response,
      appError.statusCode,
      "Firebase verification failed",
      appError.message,
      appError.code
    );
  }
};

// Backward-compatible alias
export const login = firebaseVerify;

export const refreshToken = async (request: Request, response: Response): Promise<Response> => {
  try {
    const refreshTokenValue = getRefreshTokenFromRequest(request);

    if (!refreshTokenValue) {
      return sendError(
        response,
        401,
        "Unauthorized",
        "Refresh token is required",
        "AUTH_003"
      );
    }

    const refreshResult = await authService.refreshAccessToken(refreshTokenValue);

    return sendSuccess(response, 200, "Access token refreshed successfully", {
      accessToken: refreshResult.accessToken,
      user: refreshResult.user
    });
  } catch (error) {
    const appError =
      error instanceof AppError ? error : new AppError("Token refresh failed", 500, "INTERNAL_500");

    clearRefreshCookie(response);

    return sendError(
      response,
      appError.statusCode,
      "Refresh token verification failed",
      appError.message,
      appError.code
    );
  }
};

// Backward-compatible alias
export const refresh = refreshToken;

export const logout = async (request: Request, response: Response): Promise<Response> => {
  try {
    const refreshTokenValue = getRefreshTokenFromRequest(request);

    if (refreshTokenValue) {
      await authService.logout(refreshTokenValue);
    }

    clearRefreshCookie(response);

    return sendSuccess(
      response,
      200,
      "Logout successful",
      {
        loggedOut: true,
        sessionCleared: true
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown logout error";

    clearRefreshCookie(response);

    return sendError(response, 500, "Logout failed", errorMessage, "INTERNAL_500");
  }
};

export const me = async (request: Request, response: Response): Promise<Response> => {
  try {
    const userId = request.user?.userId;

    if (!userId) {
      return sendError(response, 401, "Unauthorized", "User context missing", "AUTH_003");
    }

    const user = await authService.getCurrentUserProfile(userId);

    return sendSuccess(response, 200, "Authenticated user profile fetched successfully", user);
  } catch (error) {
    const appError =
      error instanceof AppError ? error : new AppError("Failed to fetch user profile", 500, "INTERNAL_500");

    return sendError(
      response,
      appError.statusCode,
      "Failed to fetch user profile",
      appError.message,
      appError.code
    );
  }
};

export const signup = async (request: Request, response: Response): Promise<Response> => {
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

    return sendSuccess(response, 201, "Signup and profile completion successful", createdRecord);
  } catch (error) {
    const appError =
      error instanceof AppError ? error : new AppError("Signup failed", 500, "INTERNAL_500");

    logger.warn("Signup controller failure", {
      endpoint: "auth/signup",
      requestId: request.requestId,
      error: appError.message,
      code: appError.code,
      timestamp: new Date().toISOString()
    });

    return sendError(
      response,
      appError.statusCode,
      "Signup failed",
      appError.message,
      appError.code
    );
  }
};
