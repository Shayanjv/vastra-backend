import { z } from "zod";

/**
 * GET /api/v1/weather/:city
 * Fetch weather for city
 */
export const getWeatherParamsSchema = z.object({
  city: z
    .string()
    .min(1, "City name is required")
    .max(100, "City name must be 100 characters or less")
    .regex(/^[a-zA-Z\s,.-]*$/, "City name contains invalid characters")
});
