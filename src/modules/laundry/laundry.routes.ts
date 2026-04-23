import { Router } from "express";
import { validateRequest } from "../../middleware/validate.middleware";
import {
  createLaundryRecord,
  getLaundryHistory,
  getLaundryQueue,
  getLaundryStats,
  getLaundryTips,
  listLaundryRecords,
  markLaundryAsWashed
} from "./laundry.controller";
import {
  createLaundrySchema,
  laundryHistoryQuerySchema,
  laundryQueueQuerySchema,
  laundryStatsQuerySchema,
  laundryTipsParamsSchema,
  markWashedSchema,
  paginationQuerySchema
} from "./laundry.dto";

const laundryRoutes = Router();

laundryRoutes.get("/queue", validateRequest({ query: laundryQueueQuerySchema }), getLaundryQueue);
laundryRoutes.post("/mark-washed", validateRequest({ body: markWashedSchema }), markLaundryAsWashed);
laundryRoutes.get("/history", validateRequest({ query: laundryHistoryQuerySchema }), getLaundryHistory);
laundryRoutes.get("/stats", validateRequest({ query: laundryStatsQuerySchema }), getLaundryStats);
laundryRoutes.get(
  "/tips/:fabricType",
  validateRequest({ params: laundryTipsParamsSchema }),
  getLaundryTips
);

// Backward-compatible scaffold routes
laundryRoutes.get("/", validateRequest({ query: paginationQuerySchema }), listLaundryRecords);
laundryRoutes.post("/", validateRequest({ body: createLaundrySchema }), createLaundryRecord);

export default laundryRoutes;
