import type { Request, Response } from "express";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { sendError, sendSuccess } from "../../utils/response.util";
import uploadService from "./upload.service";

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Helper to resolve user ID
 */
const resolveUserId = (request: Request): string => {
  const userId = request.user?.userId;
  if (!userId) {
    throw new AppError("User context missing", 401, "AUTH_003");
  }
  return userId;
};

/**
 * Helper to validate file
 */
const validateFile = (file: Express.Multer.File | undefined): void => {
  if (!file) {
    throw new AppError("No file was uploaded", 400, "UPLOAD_002");
  }

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new AppError(
      "Invalid file type - only JPEG, PNG, and WEBP are allowed",
      400,
      "UPLOAD_002"
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError(
      `File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
      400,
      "UPLOAD_002"
    );
  }
};

/**
 * Helper to handle upload errors
 */
const handleUploadError = (
  request: Request,
  response: Response,
  error: unknown,
  endpoint: string
): Response => {
  const appError =
    error instanceof AppError ? error : new AppError("Upload failed", 500, "UPLOAD_001");

  const logPayload = {
    endpoint,
    method: request.method,
    requestId: request.requestId,
    userId: request.user?.userId,
    statusCode: appError.statusCode,
    error: appError.message,
    timestamp: new Date().toISOString()
  };

  if (appError.statusCode >= 500) {
    logger.error("Upload operation failed", logPayload);
  } else {
    logger.warn("Upload operation failed", logPayload);
  }

  return sendError(response, appError.statusCode, "Upload failed", appError.message, appError.code);
};

/**
 * POST /api/v1/uploads/cloth-photo
 * Upload cloth photo
 */
export const uploadClothPhoto = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    validateFile(request.file);

    const uploadedImage = await uploadService.uploadClothPhoto(
      userId,
      request.file!.buffer,
      request.file!.mimetype
    );

    logger.info("Cloth photo uploaded successfully", {
      userId,
      publicId: uploadedImage.publicId,
      bytes: uploadedImage.bytes
    });

    return sendSuccess(response, 201, "Cloth photo uploaded successfully", uploadedImage);
  } catch (error) {
    return handleUploadError(request, response, error, "upload/cloth-photo");
  }
};

/**
 * POST /api/v1/uploads/profile-photo
 * Upload profile photo and update user
 */
export const uploadProfilePhoto = async (
  request: Request,
  response: Response
): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    validateFile(request.file);

    const uploadedImage = await uploadService.uploadProfilePhoto(
      userId,
      request.file!.buffer,
      request.file!.mimetype
    );

    logger.info("Profile photo uploaded and user updated", {
      userId,
      publicId: uploadedImage.publicId,
      bytes: uploadedImage.bytes
    });

    return sendSuccess(response, 201, "Profile photo uploaded successfully", uploadedImage);
  } catch (error) {
    return handleUploadError(request, response, error, "upload/profile-photo");
  }
};

/**
 * POST /api/v1/uploads/image (legacy)
 * Generic image upload
 */
export const uploadImage = async (request: Request, response: Response): Promise<Response> => {
  try {
    const userId = resolveUserId(request);
    validateFile(request.file);

    const folder = typeof request.body.folder === "string" ? request.body.folder : undefined;

    const uploadedImage = await uploadService.uploadImage(
      userId,
      request.file!.buffer,
      request.file!.mimetype,
      folder
    );

    return sendSuccess(response, 201, "Image uploaded successfully", uploadedImage);
  } catch (error) {
    return handleUploadError(request, response, error, "upload/image");
  }
};
