import cors, { type CorsOptions } from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Server } from "http";
import helmet from "helmet";
import morgan from "morgan";
import { v4 as uuidv4 } from "uuid";
import prisma, { connectDatabase } from "./config/database";
import environment from "./config/environment";
import redis, { connectRedis } from "./config/redis";
import { initializeSentry } from "./config/sentry";
import { requireAuth } from "./middleware/auth.middleware";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { globalRateLimiter } from "./middleware/rate-limit.middleware";
import authRoutes from "./modules/auth/auth.routes";
import clothRoutes from "./modules/cloth/cloth.routes";
import laundryRoutes from "./modules/laundry/laundry.routes";
import notificationRoutes from "./modules/notification/notification.routes";
import occasionRoutes from "./modules/occasion/occasion.routes";
import outfitRoutes from "./modules/outfit/outfit.routes";
import qualityRoutes from "./modules/quality/quality.routes";
import uploadRoutes from "./modules/upload/upload.routes";
import weatherRoutes from "./modules/weather/weather.routes";
import userRoutes from "./modules/user/user.routes";
import logger from "./utils/logger.util";
import { sendSuccess } from "./utils/response.util";

const app = express();
let httpServer: Server | null = null;
let isShuttingDown = false;

const allowedOrigins = environment.CORS_ORIGIN.split(",").map((origin) => origin.trim());

const corsOptions: CorsOptions = {
  origin: (requestOrigin, callback) => {
    if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
      callback(null, true);
      return;
    }

    callback(new Error("CORS policy blocked this origin"), false);
  },
  credentials: true
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(globalRateLimiter);

app.use((request: Request, response: Response, next: NextFunction) => {
  const incomingRequestId = request.headers["x-request-id"];

  let requestId = uuidv4();

  if (typeof incomingRequestId === "string" && incomingRequestId.trim().length > 0) {
    requestId = incomingRequestId;
  }

  if (
    Array.isArray(incomingRequestId) &&
    incomingRequestId.length > 0 &&
    typeof incomingRequestId[0] === "string"
  ) {
    requestId = incomingRequestId[0];
  }

  request.requestId = requestId;
  response.setHeader("x-request-id", requestId);

  next();
});

app.use(
  morgan(":method :url :status :response-time ms", {
    stream: {
      write: (message: string): void => {
        logger.info(message.trim());
      }
    }
  })
);

app.get("/health", (_request: Request, response: Response) => {
  return sendSuccess(
    response,
    200,
    "Vastra backend is healthy",
    {
      service: "vastra-backend",
      environment: environment.NODE_ENV
    }
  );
});

app.use("/api/auth", authRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/user", requireAuth, userRoutes);
app.use("/api/v1/users", requireAuth, userRoutes);
app.use("/api/clothes", requireAuth, clothRoutes);
app.use("/api/v1/clothes", requireAuth, clothRoutes);
app.use("/api/outfits", requireAuth, outfitRoutes);
app.use("/api/v1/outfits", requireAuth, outfitRoutes);
app.use("/api/laundry", requireAuth, laundryRoutes);
app.use("/api/v1/laundry", requireAuth, laundryRoutes);
app.use("/api/v1/quality", requireAuth, qualityRoutes);
app.use("/api/occasions", requireAuth, occasionRoutes);
app.use("/api/v1/occasions", requireAuth, occasionRoutes);
app.use("/api/v1/notifications", requireAuth, notificationRoutes);
app.use("/api/v1/uploads", requireAuth, uploadRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/v1/weather", weatherRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const shutdown = async (): Promise<void> => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  try {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer?.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await prisma.$disconnect();

    if (redis.status === "ready") {
      await redis.quit();
    } else if (redis.status !== "end") {
      redis.disconnect(false);
    }

    logger.info("Graceful shutdown completed.", {
      endpoint: "shutdown",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Graceful shutdown failed.", {
      endpoint: "shutdown",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown shutdown error"
    });
  }
};

process.once("SIGINT", () => {
  void shutdown().finally(() => {
    process.exit(0);
  });
});

process.once("SIGTERM", () => {
  void shutdown().finally(() => {
    process.exit(0);
  });
});

process.once("SIGUSR2", () => {
  void shutdown().finally(() => {
    process.kill(process.pid, "SIGUSR2");
  });
});

const startServer = async (): Promise<void> => {
  try {
    initializeSentry();

    await connectDatabase();
    await connectRedis();

    httpServer = app.listen(environment.PORT, () => {
      logger.info(`Server is running on port ${environment.PORT}`, {
        endpoint: "startup",
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown startup error";

    logger.error("Failed to start server", {
      error: errorMessage,
      endpoint: "startup",
      timestamp: new Date().toISOString()
    });

    process.exit(1);
  }
};

void startServer();

export default app;
