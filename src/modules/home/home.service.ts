import prisma from "../../config/database";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";

interface DashboardData {
  totalClothes: number;
  clothesNeedingWash: number;
  upcomingOccasions: number;
  suggestedOutfit: Record<string, unknown> | null;
}

class HomeService {
  public async getDashboard(userId: string, _period: string): Promise<DashboardData> {
    try {
      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, is_deleted: true, is_active: true }
      });

      if (!user || user.is_deleted || !user.is_active) {
        throw new AppError("User not found", 404, "USER_001");
      }

      // Count total clothes
      const totalClothes = await prisma.cloth.count({
        where: {
          user_id: userId,
          is_deleted: false
        }
      });

      // Count clothes needing wash (placeholder logic)
      const clothesNeedingWash = await prisma.cloth.count({
        where: {
          user_id: userId,
          is_deleted: false,
          last_worn_at: {
            lt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
          }
        }
      });

      // Count upcoming occasions
      const upcomingOccasions = await prisma.occasion.count({
        where: {
          user_id: userId,
          is_deleted: false,
          outfit_date: {
            gte: new Date()
          }
        }
      });

      logger.info("Dashboard fetched", {
        endpoint: "home/dashboard",
        userId,
        totalClothes,
        clothesNeedingWash,
        upcomingOccasions,
        timestamp: new Date().toISOString()
      });

      return {
        totalClothes,
        clothesNeedingWash,
        upcomingOccasions,
        suggestedOutfit: null
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error("Dashboard service error", {
        endpoint: "home/dashboard",
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      });

      throw new AppError("Failed to fetch dashboard", 500, "INTERNAL_500");
    }
  }
}

const homeService = new HomeService();

export default homeService;
