import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { authRateLimiter } from "../../middleware/rate-limit.middleware";
import { validateRequest } from "../../middleware/validate.middleware";
import { firebaseVerify, login, logout, me, refresh, refreshToken } from "./auth.controller";
import { authLoginSchema, authRefreshSchema, firebaseVerifySchema, refreshTokenSchema } from "./auth.dto";

const authRoutes = Router();

authRoutes.post(
	"/firebase-verify",
	authRateLimiter,
	validateRequest({ body: firebaseVerifySchema }),
	firebaseVerify
);
authRoutes.post(
	"/refresh-token",
	authRateLimiter,
	validateRequest({ body: refreshTokenSchema }),
	refreshToken
);
authRoutes.post("/logout", authRateLimiter, logout);
authRoutes.get("/me", authRateLimiter, requireAuth, me);

// Backward-compatible routes
authRoutes.post("/login", authRateLimiter, validateRequest({ body: authLoginSchema }), login);
authRoutes.post("/refresh", authRateLimiter, validateRequest({ body: authRefreshSchema }), refresh);

export default authRoutes;
