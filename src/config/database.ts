import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import environment from "./environment";
import logger from "../utils/logger.util";

const pool = new pg.Pool({
  connectionString: environment.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 25
});

const adapter = new PrismaPg(pool);

const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    adapter,
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

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  await pool.end();
};

export default prisma;
