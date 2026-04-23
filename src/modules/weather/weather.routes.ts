import { Router } from "express";
import { validateRequest } from "../../middleware/validate.middleware";
import { getWeather } from "./weather.controller";
import { getWeatherParamsSchema } from "./weather.dto";

const weatherRoutes = Router();

/**
 * GET /api/weather/:city
 * Get current weather for city
 * Public endpoint (no auth required)
 */
weatherRoutes.get(
  "/:city",
  validateRequest({ params: getWeatherParamsSchema }),
  getWeather
);

export default weatherRoutes;
