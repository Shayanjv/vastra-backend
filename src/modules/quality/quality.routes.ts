import { Router } from "express";
import { validateRequest } from "../../middleware/validate.middleware";
import {
  getQualityScore,
  getAlerts,
  getBestPreserved,
  getHistory,
  recordManualQuality
} from "./quality.controller";
import {
  getQualityScoreParamsSchema,
  getQualityScoreQuerySchema,
  getAlertsQuerySchema,
  getBestPreservedQuerySchema,
  getHistoryParamsSchema,
  getHistoryQuerySchema,
  recordQualitySchema
} from "./quality.dto";

const qualityRoutes = Router();

/**
 * GET /api/v1/quality/alerts
 * Get all clothes below 40% quality - must be before /:clothId route
 */
qualityRoutes.get(
  "/alerts",
  validateRequest({ query: getAlertsQuerySchema }),
  getAlerts
);

/**
 * GET /api/v1/quality/best-preserved
 * Get top preserved clothes - must be before /:clothId route
 */
qualityRoutes.get(
  "/best-preserved",
  validateRequest({ query: getBestPreservedQuerySchema }),
  getBestPreserved
);

/**
 * GET /api/v1/quality/:clothId
 * Get current quality score with prediction and advice
 */
qualityRoutes.get(
  "/:clothId",
  validateRequest({ params: getQualityScoreParamsSchema, query: getQualityScoreQuerySchema }),
  getQualityScore
);

/**
 * GET /api/v1/quality/history/:clothId
 * Get quality history for charting - must be after GET /:clothId route
 */
qualityRoutes.get(
  "/history/:clothId",
  validateRequest({ params: getHistoryParamsSchema, query: getHistoryQuerySchema }),
  getHistory
);

/**
 * POST /api/v1/quality/record
 * Manually record a quality check
 */
qualityRoutes.post(
  "/record",
  validateRequest({ body: recordQualitySchema }),
  recordManualQuality
);

export default qualityRoutes;
