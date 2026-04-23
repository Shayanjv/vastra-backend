import { Router } from "express";
import { validateRequest } from "../../middleware/validate.middleware";
import {
  deleteClothRecord,
  createClothRecord,
  getClothRecord,
  getClothStats,
  listClothRecords,
  recordClothWash,
  recordClothWear,
  updateClothRecord
} from "./cloth.controller";
import {
  clothIdParamsSchema,
  clothListQuerySchema,
  clothWashSchema,
  clothWearSchema,
  createClothSchema,
  updateClothSchema
} from "./cloth.dto";

const clothRoutes = Router();

clothRoutes.get("/", validateRequest({ query: clothListQuerySchema }), listClothRecords);
clothRoutes.post("/", validateRequest({ body: createClothSchema }), createClothRecord);
clothRoutes.get("/stats", getClothStats);
clothRoutes.get("/:id", validateRequest({ params: clothIdParamsSchema }), getClothRecord);
clothRoutes.put(
  "/:id",
  validateRequest({ params: clothIdParamsSchema, body: updateClothSchema }),
  updateClothRecord
);
clothRoutes.delete("/:id", validateRequest({ params: clothIdParamsSchema }), deleteClothRecord);
clothRoutes.post(
  "/:id/wear",
  validateRequest({ params: clothIdParamsSchema, body: clothWearSchema }),
  recordClothWear
);
clothRoutes.post(
  "/:id/wash",
  validateRequest({ params: clothIdParamsSchema, body: clothWashSchema }),
  recordClothWash
);

export default clothRoutes;
