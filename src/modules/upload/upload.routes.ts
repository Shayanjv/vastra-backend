import multer from "multer";
import { Router } from "express";
import { validateRequest } from "../../middleware/validate.middleware";
import {
  uploadClothPhoto,
  uploadProfilePhoto,
  uploadImage
} from "./upload.controller";
import { uploadClothPhotoSchema, uploadProfilePhotoSchema, uploadBodySchema } from "./upload.dto";

const uploadRoutes = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

/**
 * POST /api/v1/uploads/cloth-photo
 * Upload cloth image
 */
uploadRoutes.post(
  "/cloth-photo",
  upload.single("file"),
  validateRequest({ body: uploadClothPhotoSchema }),
  uploadClothPhoto
);

/**
 * POST /api/v1/uploads/profile-photo
 * Upload profile image and update user
 */
uploadRoutes.post(
  "/profile-photo",
  upload.single("file"),
  validateRequest({ body: uploadProfilePhotoSchema }),
  uploadProfilePhoto
);

/**
 * POST /api/v1/uploads/image (legacy)
 * Generic image upload
 */
uploadRoutes.post(
  "/image",
  upload.single("file"),
  validateRequest({ body: uploadBodySchema }),
  uploadImage
);

export default uploadRoutes;
