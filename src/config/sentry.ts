import * as Sentry from "@sentry/node";
import environment from "./environment";
import logger from "../utils/logger.util";

export const initializeSentry = (): void => {
  const sentryDsn = typeof environment.SENTRY_DSN === "string" ? environment.SENTRY_DSN.trim() : "";

  if (!sentryDsn || sentryDsn.startsWith("replace_with_")) {
    logger.warn("SENTRY_DSN not configured. Sentry is disabled.");
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment: environment.NODE_ENV,
      tracesSampleRate: environment.NODE_ENV === "production" ? 0.1 : 1
    });
  } catch (error) {
    logger.warn("Sentry initialization skipped due to invalid DSN.", {
      error: error instanceof Error ? error.message : "Unknown Sentry init error"
    });
  }
};

export { Sentry };
