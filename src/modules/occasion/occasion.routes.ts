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

export default occasionRoutes;
