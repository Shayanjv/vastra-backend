import logger from "../utils/logger.util";

/**
 * Wrap a promise with a timeout.
 * If timeout is exceeded, reject with error but allow caller to handle.
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
};

/**
 * Non-blocking startup: Start database and Redis in parallel,
 * but don't fail if Redis times out (cache is optional).
 * Fail only if database times out (data is required).
 */
export const startupWithTimeouts = async (
  connectDb: () => Promise<void>,
  connectCache: () => Promise<void>
): Promise<void> => {
  const DB_TIMEOUT_MS = 30000; // 30s for database
  const CACHE_TIMEOUT_MS = 10000; // 10s for Redis

  try {
    // Database connection is critical
    await withTimeout(
      connectDb(),
      DB_TIMEOUT_MS,
      `Database connection timeout after ${DB_TIMEOUT_MS}ms`
    );
    logger.info("✓ Database connected");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown DB error";
    logger.error("✗ Database connection failed (startup halted)", { error: msg });
    throw error; // Fail startup if DB fails
  }

  try {
    // Redis (cache) is optional — don't block startup
    await withTimeout(
      connectCache(),
      CACHE_TIMEOUT_MS,
      `Redis connection timeout after ${CACHE_TIMEOUT_MS}ms`
    );
    logger.info("✓ Redis cache connected");
  } catch (error) {
    // Log warning but continue — cache is optional
    const msg = error instanceof Error ? error.message : "Unknown Redis error";
    logger.warn("⚠ Redis cache unavailable (startup continues)", { error: msg });
  }
};
