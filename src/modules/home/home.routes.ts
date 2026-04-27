import { Router } from "express";
import { validateRequest } from "../../middleware/validate.middleware";
import { getDashboard } from "./home.controller";
import { dashboardQuerySchema } from "./home.dto";

const homeRoutes = Router();

homeRoutes.get("/dashboard", validateRequest({ query: dashboardQuerySchema }), getDashboard);

export default homeRoutes;
