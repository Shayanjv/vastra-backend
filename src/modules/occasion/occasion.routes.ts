import { Router } from "express";
import { validateRequest } from "../../middleware/validate.middleware";
import {
  createOccasionEntry,
  getOccasionHistory,
  getOccasionsList
} from "./occasion.controller";
import {
  createOccasionSchema,
  occasionHistoryQuerySchema,
  occasionListQuerySchema
} from "./occasion.dto";

const occasionRoutes = Router();

occasionRoutes.get("/history", validateRequest({ query: occasionHistoryQuerySchema }), getOccasionHistory);
occasionRoutes.get("/", validateRequest({ query: occasionListQuerySchema }), getOccasionsList);
occasionRoutes.post("/", validateRequest({ body: createOccasionSchema }), createOccasionEntry);
occasionRoutes.post(
  "/wedding-plan",
  async (req, res) => {
    res.status(501).json({
      success: false,
      message: "Wedding planning not yet implemented",
      error: "WEDDING_PLAN_NOT_IMPLEMENTED",
      code: "WEDDING_PLAN_001",
      timestamp: new Date().toISOString()
    });
  }
);
occasionRoutes.get(
  "/wedding-plan",
  async (req, res) => {
    res.status(501).json({
      success: false,
      message: "Get wedding plans not yet implemented",
      error: "WEDDING_PLAN_GET_NOT_IMPLEMENTED",
      code: "WEDDING_PLAN_GET_001",
      timestamp: new Date().toISOString()
    });
  }
);
occasionRoutes.get(
  "/wedding-plan/:planId",
  async (req, res) => {
    res.status(501).json({
      success: false,
      message: "Get wedding plan not yet implemented",
      error: "WEDDING_PLAN_DETAIL_NOT_IMPLEMENTED",
      code: "WEDDING_PLAN_DETAIL_001",
      timestamp: new Date().toISOString()
    });
  }
);

export default occasionRoutes;
