import winston from "winston";
import environment from "../config/environment";

const jsonFormatter = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const normalizedMessage = typeof message === "string" ? message : JSON.stringify(message);

  return JSON.stringify({
    level,
    message: normalizedMessage,
    timestamp,
    ...meta
  });
});

const devConsoleFormatter = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const normalizedMessage = typeof message === "string" ? message : JSON.stringify(message);
  const visibleMeta = Object.entries(meta).filter(([key]) => key !== "service");

  if (visibleMeta.length === 0) {
    return `${timestamp} [${level}] ${normalizedMessage}`;
  }

  return `${timestamp} [${level}] ${normalizedMessage} ${JSON.stringify(
    Object.fromEntries(visibleMeta)
  )}`;
});

const logger = winston.createLogger({
  level: environment.LOG_LEVEL,
  defaultMeta: {
    service: "vastra-backend"
  },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    jsonFormatter
  ),
  transports: [
    new winston.transports.Console({
      format:
        environment.NODE_ENV === "production"
          ? winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              jsonFormatter
            )
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.timestamp(),
              devConsoleFormatter
            )
    })
  ]
});

export default logger;
