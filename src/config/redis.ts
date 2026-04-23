import Redis from "ioredis";
import environment from "./environment";
import logger from "../utils/logger.util";

let redisErrorLogged = false;

const hasMaskedPassword = (redisUrl: string): boolean => {
  try {
    const password = new URL(redisUrl).password;
    return password.length > 0 && /^\*+$/.test(password);
  } catch {
    return false;
  }
};

const redis = new Redis(environment.REDIS_URL, {
  maxRetriesPerRequest: 2,
  connectTimeout: 10000,
  lazyConnect: true,
  enableAutoPipelining: true,
  retryStrategy: (attempt: number): number | null => {
    if (environment.NODE_ENV !== "production") {
      return attempt > 1 ? null : 500;
    }

    return Math.min(attempt * 500, 5000);
  }
});

redis.on("error", (error: Error) => {
  if (!redisErrorLogged) {
    redisErrorLogged = true;

    logger.warn("Redis unavailable. Cache features are temporarily disabled.", {
      error: error.message
    });

    return;
  }

  if (environment.NODE_ENV === "production") {
    logger.error("Redis error.", {
      error: error.message
    });
  }
});

redis.on("connect", () => {
  redisErrorLogged = false;
  logger.info("Redis connection established.");
});

export const connectRedis = async (): Promise<void> => {
  if (hasMaskedPassword(environment.REDIS_URL)) {
    logger.warn("REDIS_URL password looks masked. Update it with the real Redis password.");
    return;
  }

  if (redis.status === "ready" || redis.status === "connect") {
    return;
  }

  try {
    await redis.connect();
    logger.info("Redis connected successfully.");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown redis error";

    logger.warn("Redis connect attempt failed. Server will continue without cache.", {
      error: errorMessage
    });

    redis.disconnect(false);
  }
};

export default redis;
