import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1, "JWT_ACCESS_EXPIRES_IN is required"),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1, "JWT_REFRESH_EXPIRES_IN is required"),
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, "FIREBASE_CLIENT_EMAIL is required"),
  FIREBASE_PRIVATE_KEY: z.string().min(1, "FIREBASE_PRIVATE_KEY is required"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
  SENTRY_DSN: z.string().optional(),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),
  OPENWEATHER_API_KEY: z.string().optional(),
  OPENWEATHER_BASE_URL: z.string().default("https://api.openweathermap.org/data/2.5"),
  MISTRAL_API_KEY: z.string().min(1, "MISTRAL_API_KEY is required"),
  MISTRAL_BASE_URL: z.string().default("https://api.mistral.ai/v1"),
  MISTRAL_MODEL: z.string().default("mistral-medium-latest"),
  NVIDIA_GEMMA_API_KEY: z.string().min(1, "NVIDIA_GEMMA_API_KEY is required"),
  NVIDIA_BASE_URL: z.string().default("https://integrate.api.nvidia.com/v1"),
  NVIDIA_GEMMA_MODEL: z.string().default("google/gemma-3-27b-it")
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const issues = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment variables. ${issues}`);
}

const environment = {
  ...parsedEnvironment.data,
  FIREBASE_PRIVATE_KEY: parsedEnvironment.data.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
};

export type Environment = typeof environment;

export default environment;
