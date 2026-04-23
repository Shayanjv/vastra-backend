import {
  type UploadApiOptions,
  type UploadApiResponse,
  type UploadApiErrorResponse
} from "cloudinary";
import { removeBackground } from "@imgly/background-removal-node";
import cloudinary from "../../config/cloudinary";
import prisma from "../../config/database";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";

interface UploadResult {
  publicId: string;
  secureUrl: string;
  resourceType: string;
  bytes: number;
  format: string;
}

class UploadService {
  /**
   * Remove background from image using local processing
   * No external API call - runs entirely in Node.js
   * Returns processed image buffer
   * @param fileBuffer Image buffer (PNG, JPG, WebP)
   * @returns Buffer with background removed
   */
  private async removeBackgroundFromImage(fileBuffer: Buffer): Promise<Buffer> {
    try {
      // removeBackground returns Blob, convert to Buffer
      const blob = await removeBackground(fileBuffer);
      const arrayBuffer = await blob.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.warn("Background removal failed, proceeding without background removal", {
        error: error instanceof Error ? error.message : "Unknown background removal error"
      });
      // Return original buffer if background removal fails
      return fileBuffer;
    }
  }

  private uploadBuffer(
    fileBuffer: Buffer,
    options: UploadApiOptions
  ): Promise<UploadApiResponse> {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error) {
            reject(error);
            return;
          }

          if (!result) {
            reject(new Error("Cloudinary returned an empty response"));
            return;
          }

          resolve(result);
        }
      );

      uploadStream.end(fileBuffer);
    });
  }

  public async uploadImage(
    userId: string,
    fileBuffer: Buffer,
    mimetype: string,
    folder?: string
  ): Promise<UploadResult> {
    try {
      const folderName = folder ?? "vastra/uploads";

      const uploadResult = await this.uploadBuffer(fileBuffer, {
        folder: `${folderName}/${userId}`,
        resource_type: "image",
        format: mimetype.includes("png")
          ? "png"
          : mimetype.includes("webp")
            ? "webp"
            : "jpg"
      });

      return {
        publicId: uploadResult.public_id,
        secureUrl: uploadResult.secure_url,
        resourceType: uploadResult.resource_type,
        bytes: uploadResult.bytes,
        format: uploadResult.format
      };
    } catch (error) {
      logger.error("Upload failed", {
        userId,
        endpoint: "upload/image",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown upload error"
      });

      throw new AppError("Image upload failed", 500, "UPLOAD_001");
    }
  }

  /**
   * Upload cloth photo with automatic background removal
   * Background is removed locally (no external API call)
   * Processed image uploaded to Cloudinary
   */
  public async uploadClothPhoto(
    userId: string,
    fileBuffer: Buffer,
    mimetype: string
  ): Promise<UploadResult> {
    try {
      // Remove background from cloth photo (improves visibility and AI tagging)
      const processedBuffer = await this.removeBackgroundFromImage(fileBuffer);

      // Upload processed image to Cloudinary
      return this.uploadImage(userId, processedBuffer, mimetype, "vastra/cloth-photos");
    } catch (error) {
      logger.error("Cloth photo upload failed", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error"
      });

      throw new AppError("Cloth photo upload failed", 500, "UPLOAD_001");
    }
  }

  /**
   * Upload profile photo and update user record
   */
  public async uploadProfilePhoto(
    userId: string,
    fileBuffer: Buffer,
    mimetype: string
  ): Promise<UploadResult> {
    try {
      // Upload image
      const uploadResult = await this.uploadImage(userId, fileBuffer, mimetype, "vastra/profile-photos");

      // Update user profile_photo_url
      await prisma.user.update({
        where: { id: userId },
        data: { profile_photo_url: uploadResult.secureUrl }
      });

      logger.info("Profile photo updated", {
        userId,
        photoUrl: uploadResult.secureUrl
      });

      return uploadResult;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error("Profile photo update failed", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error"
      });

      throw new AppError("Profile photo update failed", 500, "UPLOAD_001");
    }
  }
}

const uploadService = new UploadService();

export default uploadService;
