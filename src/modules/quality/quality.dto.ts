import { z } from "zod";

/**
 * PAGINATION
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

/**
 * CLOTH ID PARAM
 */
export const clothIdParamsSchema = z.object({
  clothId: z.string().uuid("Invalid cloth ID")
});

/**
 * GET /api/v1/quality/:clothId
 * Fetch current quality score with prediction and advice
 */
export const getQualityScoreParamsSchema = clothIdParamsSchema;

export const getQualityScoreQuerySchema = z.object({
  includeAdvice: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .default("true")
});

/**
 * GET /api/v1/quality/alerts
 * Fetch all clothes below 40% quality
 */
export const getAlertsQuerySchema = paginationQuerySchema;

/**
 * GET /api/v1/quality/best-preserved
 * Fetch top preserved clothes
 */
export const getBestPreservedQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(10).default(3)
});

/**
 * GET /api/v1/quality/history/:clothId
 * Fetch quality history for charting
 */
export const getHistoryParamsSchema = clothIdParamsSchema;

export const getHistoryQuerySchema = z.object({
  daysBack: z.coerce.number().int().positive().max(365).default(90),
  limit: z.coerce.number().int().positive().max(1000).default(100)
});

/**
 * POST /api/v1/quality/record
 * Manually record a quality check
 */
export const recordQualitySchema = z.object({
  cloth_id: z.string().uuid("Invalid cloth ID"),
  quality_score: z.number().min(0).max(100, "Quality score must be between 0 and 100"),
  notes: z.string().max(500, "Notes must be 500 characters or less").optional()
});
