import type { Request } from "express";
import rateLimit from "express-rate-limit";
import environment from "../config/environment";
import { sendError } from "../utils/response.util";

const isLocalhost = (request: Request): boolean => {
  const ip = request.ip ?? "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
};

export const globalRateLimiter = rateLimit({
  windowMs: environment.RATE_LIMIT_WINDOW_MS,
  max: environment.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalhost,
  handler: (request, response, _next, options) => {
    sendError(
      response,
      options.statusCode,
      "Too many requests",
      `Rate limit exceeded for ${request.ip}`,
      "RATE_001"
    );
  }
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalhost,
  handler: (_request, response, _next, options) => {
    sendError(
      response,
      options.statusCode,
      "Too many authentication attempts",
      "Please retry after some time",
      "AUTH_003"
    );
  }
});
