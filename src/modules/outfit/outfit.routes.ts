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
outfitRoutes.post(
  "/history",
  async (req, res) => {
    res.status(501).json({
      success: false,
      message: "Save outfit to history not yet implemented",
      error: "OUTFIT_HISTORY_NOT_IMPLEMENTED",
      code: "OUTFIT_HISTORY_001",
      timestamp: new Date().toISOString()
    });
  }
);
outfitRoutes.get(
  "/suggest/:occasionId",
  async (req, res) => {
    res.status(501).json({
      success: false,
      message: "Occasion-based outfit suggestions not yet implemented",
      error: "OUTFIT_SUGGEST_OCCASION_NOT_IMPLEMENTED",
      code: "OUTFIT_SUGGEST_OCCASION_001",
      timestamp: new Date().toISOString()
    });
  }
);

// Backward-compatible scaffold routes
outfitRoutes.get("/", validateRequest({ query: paginationQuerySchema }), listOutfitRecords);
outfitRoutes.post("/", validateRequest({ body: createOutfitSchema }), createOutfitRecord);

export default outfitRoutes;
