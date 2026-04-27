import type { Request } from "express";
import rateLimit from "express-rate-limit";
import environment from "../config/environment";
import { sendError } from "../utils/response.util";

const getClientIp = (request: Request): string => {
  const forwarded = request.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0] ?? request.socket.remoteAddress ?? "unknown";
  return (ip ?? "unknown").replace(/:\d+$/, "");
};

const isLocalhost = (request: Request): boolean => {
  const ip = getClientIp(request);
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
};

export const globalRateLimiter = rateLimit({
  windowMs: environment.RATE_LIMIT_WINDOW_MS,
  max: environment.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
  skip: isLocalhost,
  keyGenerator: getClientIp,
  handler: (request, response, _next, options) => {
    sendError(
      response,
      options.statusCode,
      "Too many requests",
      `Rate limit exceeded for ${getClientIp(request)}`,
      "RATE_001"
    );
  }
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
  skip: isLocalhost,
  keyGenerator: getClientIp,
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
