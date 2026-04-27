import { z } from "zod";
import { createUserSchema } from "../user/user.dto";

export const firebaseVerifySchema = z.object({
  idToken: z.string().min(10, "Firebase idToken is required")
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10).optional()
});

// Backward-compatible aliases
export const authLoginSchema = firebaseVerifySchema;
export const authRefreshSchema = refreshTokenSchema;

// Signup schema: reuse user creation schema for profile onboarding
export const signupSchema = createUserSchema;
