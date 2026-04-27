import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import environment from "./environment";
import logger from "../utils/logger.util";

/**
 * Strips sslmode from the connection string so that pg.Pool
 * uses ONLY our explicit ssl config (rejectUnauthorized: false).
 * The sslmode=require in the URL causes pg to treat it as verify-full,
 * which rejects Supabase's self-signed certificate chain.
 */
const sanitizeConnectionString = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("sslmode");
    return parsed.toString();
  } catch {
    // If URL parsing fails, do a regex strip as fallback
    return url
      .replace(/[?&]sslmode=[^&]*/g, "")
      .replace(/\?&/, "?")
      .replace(/\?$/, "");
  }
};

const cleanConnectionString = sanitizeConnectionString(environment.DATABASE_URL);

const pool = new pg.Pool({
  connectionString: cleanConnectionString,
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
