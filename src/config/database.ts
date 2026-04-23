import { PrismaClient } from "@prisma/client";
import environment from "./environment";
import logger from "../utils/logger.util";

const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    log:
      environment.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"]
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const prisma = global.prismaGlobal ?? createPrismaClient();

if (environment.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info("Database connected successfully.");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown database error";

    logger.error("Database connection failed.", {
      error: errorMessage
    });

    throw error;
  }
};

export default prisma;
