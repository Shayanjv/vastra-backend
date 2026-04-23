import { z } from "zod";

/**
 * COMMON
 */
export const uploadBodySchema = z.object({
  folder: z.string().min(1).max(120).optional()
});

/**
 * POST /api/v1/uploads/cloth-photo
 * Upload cloth image to Cloudinary
 */
export const uploadClothPhotoSchema = z.object({
  folder: z.string().optional().default("vastra/cloth-photos")
});

/**
 * POST /api/v1/uploads/profile-photo
 * Upload profile image to Cloudinary and update user profile
 */
export const uploadProfilePhotoSchema = z.object({
  folder: z.string().optional().default("vastra/profile-photos")
});
