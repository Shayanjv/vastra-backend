import { Router } from "express";
import { validateRequest } from "../../middleware/validate.middleware";
import {
  createOutfitRecord,
  deleteSavedOutfit,
  getOutfitHistory,
  getSavedOutfits,
  getTodayOutfit,
  listOutfitRecords,
  saveOutfitCombination,
  suggestOutfit,
  wearOutfit
} from "./outfit.controller";
import {
  createOutfitSchema,
  outfitHistoryQuerySchema,
  outfitIdParamsSchema,
  outfitWearSchema,
  paginationQuerySchema,
  savedOutfitIdParamsSchema,
  savedOutfitQuerySchema,
  saveOutfitSchema,
  suggestOutfitSchema
} from "./outfit.dto";

const outfitRoutes = Router();

outfitRoutes.post("/suggest", validateRequest({ body: suggestOutfitSchema }), suggestOutfit);
outfitRoutes.get("/today", getTodayOutfit);
outfitRoutes.get("/history", validateRequest({ query: outfitHistoryQuerySchema }), getOutfitHistory);
outfitRoutes.post(
  "/:id/wear",
  validateRequest({ params: outfitIdParamsSchema, body: outfitWearSchema }),
  wearOutfit
);
outfitRoutes.post("/save", validateRequest({ body: saveOutfitSchema }), saveOutfitCombination);
outfitRoutes.get("/saved", validateRequest({ query: savedOutfitQuerySchema }), getSavedOutfits);
outfitRoutes.delete(
  "/saved/:id",
  validateRequest({ params: savedOutfitIdParamsSchema }),
  deleteSavedOutfit
);

// Backward-compatible scaffold routes
outfitRoutes.get("/", validateRequest({ query: paginationQuerySchema }), listOutfitRecords);
outfitRoutes.post("/", validateRequest({ body: createOutfitSchema }), createOutfitRecord);

export default outfitRoutes;
