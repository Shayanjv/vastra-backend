import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../config/database";
import redis from "../../config/redis";
import { buildQualityAdviceUserPrompt, QUALITY_ADVICE_SYSTEM_PROMPT } from "../../prompts/quality-advice.prompt";
import { callMistral, parseAIResponse } from "../../utils/ai.util";
import { calculateQualityScore, projectThreeMonthQuality, type FabricTypeKey } from "../../utils/quality-algorithm.util";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";

const qualityAdviceSchema = z.object({
  advice: z.string().min(1),
  monsoon_tips: z.string().nullable(),
  ethnic_care: z.string().nullable(),
  extend_life_tips: z.array(z.string()).default([]),
  sell_suggestion: z.boolean(),
  sell_reason: z.string().nullable()
});

const QUALITY_CACHE_TTL_SECONDS = 3600; // 1 hour

const clothDetailSelect = {
  id: true,
  user_id: true,
  name: true,
  category: true,
  fabric_type: true,
  color_primary: true,
  color_secondary: true,
  photo_urls: true,
  wear_count: true,
  wash_count: true,
  quality_score: true,
  last_washed_at: true,
  created_at: true,
  is_deleted: true,
  is_active: true
} as const;

const qualityHistorySelect = {
  id: true,
  cloth_id: true,
  quality_score: true,
  wear_count_at_record: true,
  wash_count_at_record: true,
  notes: true,
  recorded_at: true,
  created_at: true
} as const;

export interface QualityScoreResponse {
  cloth_id: string;
  cloth_name: string;
  fabric_type: string;
  current_score: number;
  three_month_projection: number;
  quality_level: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  care_advice?: QualityAdviceResponse;
}

export interface QualityAdviceResponse {
  current_condition: string;
  fabric_specific_tips: string[];
  immediate_actions: string[];
  monsoon_care: string;
  washing_guide: string;
  storage_recommendation: string;
  expected_lifespan_months: number;
  recommendation: string;
  sell_suggestion: boolean;
}

export interface QualityAlert {
  cloth_id: string;
  cloth_name: string;
  fabric_type: string;
  category: string;
  current_score: number;
  recommendation: string;
  immediate_action: string;
}

export interface BestPreservedCloth {
  cloth_id: string;
  cloth_name: string;
  fabric_type: string;
  current_score: number;
  positive_tips: string[];
}

export interface QualityHistoryDataPoint {
  recorded_at: string;
  quality_score: number;
  wear_count: number;
  wash_count: number;
  notes: string | null;
}

export interface RecordQualityInput {
  cloth_id: string;
  quality_score: number;
  notes?: string;
}

class QualityService {
  private toNumber(value: Prisma.Decimal | number | null): number {
    if (value === null) {
      return 0;
    }

    if (typeof value === "number") {
      return value;
    }

    return value.toNumber();
  }

  private normalizeFabricType(value: string): FabricTypeKey {
    const normalizedValue = value
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

    const validFabrics: FabricTypeKey[] = [
      "POLYESTER",
      "DENIM",
      "COTTON",
      "LINEN",
      "WOOL",
      "RAYON",
      "SILK",
      "KHADI",
      "OTHER"
    ];

    return (validFabrics.includes(normalizedValue as FabricTypeKey) ? normalizedValue : "OTHER") as FabricTypeKey;
  }

  private getQualityLevel(
    score: number
  ): "EXCELLENT" | "GOOD" | "FAIR" | "POOR" {
    if (score >= 80) return "EXCELLENT";
    if (score >= 60) return "GOOD";
    if (score >= 40) return "FAIR";
    return "POOR";
  }

  private getCacheKey(clothId: string): string {
    return `quality:score:${clothId}`;
  }

  private getAgeMonths(createdAt: Date): number {
    const now = new Date();
    const months =
      (now.getFullYear() - createdAt.getFullYear()) * 12 +
      (now.getMonth() - createdAt.getMonth());
    return Math.max(0, months);
  }

  private estimateAverageWashesPerMonth(
    washCount: number,
    ageMonths: number
  ): number {
    if (ageMonths === 0) return 0;
    const average = washCount / ageMonths;
    return Math.max(0.1, Math.min(average, 4)); // Clamp between 0.1 and 4 per month
  }

  /**
   * Calculate current quality score and cache it
   */
  public async calculateCurrentQuality(
    userId: string,
    clothId: string,
    useCache: boolean = true
  ): Promise<{ score: number; fabricType: FabricTypeKey }> {
    // Check cache first
    if (useCache) {
      const cached = await redis.get(this.getCacheKey(clothId));
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return parsed;
        } catch {
          logger.warn("Failed to parse cached quality score", { clothId });
        }
      }
    }

    // Fetch cloth details
    const cloth = await prisma.cloth.findFirst({
      where: {
        id: clothId,
        user_id: userId,
        is_deleted: false,
        is_active: true
      },
      select: clothDetailSelect
    });

    if (!cloth) {
      throw new AppError("Cloth not found", 404, "CLOTH_001");
    }

    // Count wash records by type
    const washCounts = await prisma.washRecord.groupBy({
      by: ["wash_type"],
      where: {
        cloth_id: clothId,
        is_deleted: false
      },
      _count: true
    });

    const washBreakdown: Record<string, number> = {
      MACHINE_WASH: 0,
      HAND_WASH: 0,
      DRY_CLEAN: 0
    };

    for (const record of washCounts) {
      washBreakdown[record.wash_type] = record._count;
    }

    const fabricType = this.normalizeFabricType(cloth.fabric_type);
    const ageMonths = this.getAgeMonths(cloth.created_at);

    const score = calculateQualityScore({
      fabric: fabricType,
      wearCount: cloth.wear_count,
      machineWashCount: washBreakdown["MACHINE_WASH"] ?? 0,
      handWashCount: washBreakdown["HAND_WASH"] ?? 0,
      dryCleanCount: washBreakdown["DRY_CLEAN"] ?? 0,
      ageMonths
    });

    // Cache the result
    await redis.set(
      this.getCacheKey(clothId),
      JSON.stringify({ score, fabricType }),
      "EX",
      QUALITY_CACHE_TTL_SECONDS
    );

    return { score, fabricType };
  }

  /**
   * Get quality score with optional Gemini advice
   */
  public async getQualityScore(
    userId: string,
    clothId: string,
    includeAdvice: boolean = true
  ): Promise<QualityScoreResponse> {
    // Get cloth and quality info
    const cloth = await prisma.cloth.findFirst({
      where: {
        id: clothId,
        user_id: userId,
        is_deleted: false,
        is_active: true
      },
      select: clothDetailSelect
    });

    if (!cloth) {
      throw new AppError("Cloth not found", 404, "CLOTH_001");
    }

    // Calculate current quality
    const { score: currentScore, fabricType } =
      await this.calculateCurrentQuality(userId, clothId, true);

    // Project 3-month quality
    const ageMonths = this.getAgeMonths(cloth.created_at);
    const avgWearPerMonth = this.estimateAverageWashesPerMonth(
      cloth.wear_count,
      ageMonths
    );

    // Count wash records by type
    const washCounts = await prisma.washRecord.groupBy({
      by: ["wash_type"],
      where: {
        cloth_id: clothId,
        is_deleted: false
      },
      _count: true
    });

    const washBreakdown: Record<string, number> = {
      MACHINE_WASH: 0,
      HAND_WASH: 0,
      DRY_CLEAN: 0
    };

    for (const record of washCounts) {
      washBreakdown[record.wash_type] = record._count;
    }

    const threeMonthProjection = projectThreeMonthQuality({
      current: {
        fabric: fabricType,
        wearCount: cloth.wear_count,
        machineWashCount: washBreakdown["MACHINE_WASH"] ?? 0,
        handWashCount: washBreakdown["HAND_WASH"] ?? 0,
        dryCleanCount: washBreakdown["DRY_CLEAN"] ?? 0,
        ageMonths
      },
      averageWearPerMonth: avgWearPerMonth,
      averageMachineWashPerMonth: ((washBreakdown["MACHINE_WASH"] ?? 0) / Math.max(1, ageMonths)),
      averageHandWashPerMonth: ((washBreakdown["HAND_WASH"] ?? 0) / Math.max(1, ageMonths)),
      averageDryCleanPerMonth: ((washBreakdown["DRY_CLEAN"] ?? 0) / Math.max(1, ageMonths))
    });

    const response: QualityScoreResponse = {
      cloth_id: cloth.id,
      cloth_name: cloth.name,
      fabric_type: cloth.fabric_type,
      current_score: currentScore,
      three_month_projection: threeMonthProjection,
      quality_level: this.getQualityLevel(currentScore)
    };

    // Get Gemini advice if requested
    if (includeAdvice) {
      try {
        const advice = await this.generateAdvice(
          cloth.name,
          cloth.fabric_type,
          cloth.wear_count,
          {
            machineWash: washBreakdown["MACHINE_WASH"] ?? 0,
            handWash: washBreakdown["HAND_WASH"] ?? 0,
            dryClean: washBreakdown["DRY_CLEAN"] ?? 0
          },
          currentScore,
          ageMonths,
          cloth.category
        );
        response.care_advice = advice;
      } catch (error) {
        logger.warn("Failed to generate care advice", {
          clothId,
          error: error instanceof Error ? error.message : "Unknown error"
        });
        // Continue without advice if Gemini fails
      }
    }

    // Save to quality history
    await prisma.qualityHistory.create({
      data: {
        cloth_id: clothId,
        user_id: userId,
        quality_score: currentScore,
        wear_count_at_record: cloth.wear_count,
        wash_count_at_record: cloth.wash_count,
        recorded_at: new Date(),
        notes: `Quality check - ${response.quality_level} condition`
      }
    });

    return response;
  }

  /**
   * Get all clothes with quality below 40% (alerts)
   */
  public async getAlerts(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ items: QualityAlert[]; total: number }> {
    const skip = (page - 1) * limit;

    // Get low-quality clothes
    const clothes = await prisma.cloth.findMany({
      where: {
        user_id: userId,
        is_deleted: false,
        is_active: true
      },
      select: clothDetailSelect,
      orderBy: {
        quality_score: "asc"
      },
      take: limit * 2 // Fetch more to account for filtering
    });

    const alertItems: QualityAlert[] = [];

    for (const cloth of clothes) {
      const score = this.toNumber(cloth.quality_score);

      if (score < 40) {
        let recommendation = "WEAR CAREFULLY";
        let immediateAction = "Hand wash only with mild soap";

        if (score < 20) {
          recommendation = "SELL OR DONATE";
          immediateAction = "Consider selling or repurposing this garment";
        } else if (score < 30) {
          recommendation = "REPAIR OR PRESERVE";
          immediateAction = "Dry clean only, store carefully";
        }

        alertItems.push({
          cloth_id: cloth.id,
          cloth_name: cloth.name,
          fabric_type: cloth.fabric_type,
          category: cloth.category,
          current_score: score,
          recommendation,
          immediate_action: immediateAction
        });
      }

      if (alertItems.length >= limit) break;
    }

    // Count total alerts
    const allAlerts = await prisma.cloth.count({
      where: {
        user_id: userId,
        is_deleted: false,
        is_active: true,
        quality_score: { lt: 40 }
      }
    });

    return {
      items: alertItems.slice(skip, skip + limit),
      total: allAlerts
    };
  }

  /**
   * Get best preserved (highest quality) clothes
   */
  public async getBestPreserved(
    userId: string,
    limit: number = 3
  ): Promise<BestPreservedCloth[]> {
    const clothes = await prisma.cloth.findMany({
      where: {
        user_id: userId,
        is_deleted: false,
        is_active: true
      },
      select: clothDetailSelect,
      orderBy: {
        quality_score: "desc"
      },
      take: limit
    });

    const result: BestPreservedCloth[] = [];

    for (const cloth of clothes) {
      const score = this.toNumber(cloth.quality_score);
      const positiveTips: string[] = [];

      if (score >= 90) {
        positiveTips.push("Excellent preservation! Continue current care routine");
      }
      if (cloth.wash_count <= 5) {
        positiveTips.push("Minimal wear extends garment lifespan");
      }
      if (cloth.fabric_type.toLowerCase().includes("polyester")) {
        positiveTips.push("Polyester durability is excellent for frequent wear");
      }

      const washCounts = await prisma.washRecord.groupBy({
        by: ["wash_type"],
        where: {
          cloth_id: cloth.id,
          is_deleted: false
        },
        _count: true
      });

      let machineWashCount = 0;
      for (const record of washCounts) {
        if (record.wash_type === "MACHINE_WASH") {
          machineWashCount = record._count;
        }
      }

      if (machineWashCount === 0 && cloth.wash_count > 0) {
        positiveTips.push("Hand washing preserves fabric quality");
      }

      result.push({
        cloth_id: cloth.id,
        cloth_name: cloth.name,
        fabric_type: cloth.fabric_type,
        current_score: score,
        positive_tips: positiveTips
      });
    }

    return result;
  }

  /**
   * Get quality history for charting
   */
  public async getHistory(
    userId: string,
    clothId: string,
    daysBack: number = 90,
    limit: number = 100
  ): Promise<QualityHistoryDataPoint[]> {
    // Verify cloth ownership
    const cloth = await prisma.cloth.findFirst({
      where: {
        id: clothId,
        user_id: userId,
        is_deleted: false
      }
    });

    if (!cloth) {
      throw new AppError("Cloth not found", 404, "CLOTH_001");
    }

    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const history = await prisma.qualityHistory.findMany({
      where: {
        cloth_id: clothId,
        user_id: userId,
        is_deleted: false,
        recorded_at: {
          gte: since
        }
      },
      select: qualityHistorySelect,
      orderBy: {
        recorded_at: "asc"
      },
      take: limit
    });

    return history.map((record) => ({
      recorded_at: record.recorded_at.toISOString(),
      quality_score: this.toNumber(record.quality_score),
      wear_count: record.wear_count_at_record,
      wash_count: record.wash_count_at_record,
      notes: record.notes
    }));
  }

  /**
   * Record a manual quality check
   */
  public async recordManualQuality(
    userId: string,
    input: RecordQualityInput
  ): Promise<QualityHistoryDataPoint> {
    // Verify cloth ownership
    const cloth = await prisma.cloth.findFirst({
      where: {
        id: input.cloth_id,
        user_id: userId,
        is_deleted: false,
        is_active: true
      },
      select: {
        id: true,
        wear_count: true,
        wash_count: true
      }
    });

    if (!cloth) {
      throw new AppError("Cloth not found", 404, "CLOTH_001");
    }

    // Create quality history record
    const record = await prisma.qualityHistory.create({
      data: {
        cloth_id: input.cloth_id,
        user_id: userId,
        quality_score: input.quality_score,
        wear_count_at_record: cloth.wear_count,
        wash_count_at_record: cloth.wash_count,
        recorded_at: new Date(),
        notes: input.notes || "Manual quality check"
      },
      select: qualityHistorySelect
    });

    // Invalidate cache
    await redis.del(this.getCacheKey(input.cloth_id));

    return {
      recorded_at: record.recorded_at.toISOString(),
      quality_score: this.toNumber(record.quality_score),
      wear_count: record.wear_count_at_record,
      wash_count: record.wash_count_at_record,
      notes: record.notes
    };
  }

  /**
   * Generate care advice using NVIDIA NIM (Mistral Large)
   * Fallback to Mistral API if NVIDIA credits exhausted
   */
  private async generateAdvice(
    clothName: string,
    fabric: string,
    wearCount: number,
    washHistory: {
      machineWash: number;
      handWash: number;
      dryClean: number;
    },
    currentScore: number,
    ageMonths: number,
    category?: string
  ): Promise<QualityAdviceResponse> {
    const washType = washHistory.machineWash > washHistory.handWash
      ? "MACHINE_WASH"
      : washHistory.handWash > 0
        ? "HAND_WASH"
        : "DRY_CLEAN";

    const prompt = buildQualityAdviceUserPrompt({
      cloth_name: clothName,
      fabric_type: fabric,
      quality_score: currentScore,
      wear_count: wearCount,
      wash_count: washHistory.machineWash + washHistory.handWash + washHistory.dryClean,
      wash_type: washType,
      city: "India",
      season: "all-season"
    });

    try {
      const responseText = await callMistral(prompt, QUALITY_ADVICE_SYSTEM_PROMPT);
      const advice = parseAIResponse(responseText, qualityAdviceSchema);

      return {
        current_condition: currentScore >= 80 ? "EXCELLENT" : currentScore >= 60 ? "GOOD" : currentScore >= 40 ? "FAIR" : "POOR",
        fabric_specific_tips: advice.extend_life_tips ?? [],
        immediate_actions: [advice.advice],
        monsoon_care: advice.monsoon_tips ?? "Store in a dry and ventilated area.",
        washing_guide: washType,
        storage_recommendation: advice.ethnic_care ?? "Use breathable storage covers and avoid damp areas.",
        expected_lifespan_months: Math.max(1, Math.round(ageMonths + currentScore / 4)),
        recommendation: advice.sell_suggestion ? "SELL_OR_REPURPOSE" : "PRESERVE",
        sell_suggestion: advice.sell_suggestion
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI error";
      logger.error("Care advice generation failed", {
        clothName,
        error: message
      });

      throw new AppError("Failed to generate care advice", 500, "OUTFIT_002");
    }
  }
}

const qualityService = new QualityService();

export default qualityService;
