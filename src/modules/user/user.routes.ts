import { Router } from "express";
import { validateRequest } from "../../middleware/validate.middleware";
import {
  createUserRecord,
  deleteUserAccount,
  getCurrentUserProfile,
  getUserPreferences,
  listUserRecords,
  saveUserFcmToken,
  updateCurrentUserProfile,
  updateUserPreferences
} from "./user.controller";
import {
  createUserSchema,
  paginationQuerySchema,
  updateFcmTokenSchema,
  updateUserPreferencesSchema,
  updateUserProfileSchema
} from "./user.dto";

const userRoutes = Router();

userRoutes.get("/profile", getCurrentUserProfile);
userRoutes.put("/profile", validateRequest({ body: updateUserProfileSchema }), updateCurrentUserProfile);
userRoutes.get("/preferences", getUserPreferences);
userRoutes.put(
  "/preferences",
  validateRequest({ body: updateUserPreferencesSchema }),
  updateUserPreferences
);
userRoutes.delete("/account", deleteUserAccount);
userRoutes.post("/fcm-token", validateRequest({ body: updateFcmTokenSchema }), saveUserFcmToken);

// Backward-compatible scaffold routes
userRoutes.get("/", validateRequest({ query: paginationQuerySchema }), listUserRecords);
userRoutes.post("/", validateRequest({ body: createUserSchema }), createUserRecord);

export default userRoutes;
