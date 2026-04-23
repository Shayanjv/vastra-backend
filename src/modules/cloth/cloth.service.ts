import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../config/database";
import { buildClothTaggingUserPrompt, CLOTH_TAGGING_SYSTEM_PROMPT } from "../../prompts/cloth-tagging.prompt";
import { callGemmaVision, parseAIResponse } from "../../utils/ai.util";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { calculateQualityScore, type FabricTypeKey } from "../../utils/quality-algorithm.util";

const clothTaggingSchema = z.object({
  category: z.string().min(1),
  fabric_type: z.string().min(1),
  color_primary: z.string().min(1),
  color_secondary: z.string().nullable().optional(),
  pattern: z.string().min(1),
  occasion_suitability: z.array(z.string().min(1)).default(["casual"]),
  season_suitability: z.array(z.string().min(1)).default(["all-season"]),
  care_instructions: z.string().min(1).optional(),
  estimated_fabric_quality: z.string().min(1).optional()
});

const INITIAL_QUALITY_SCORE = 100;
const RARELY_WORN_THRESHOLD = 2;

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const clothSelect = {
  id: true,
  user_id: true,
  name: true,
  category: true,
  fabric_type: true,
  color_primary: true,
  color_secondary: true,
  pattern: true,
  brand: true,
  purchase_price: true,
  purchase_date: true,
  occasions: true,
  season: true,
  size: true,
  care_instructions: true,
  photo_urls: true,
  wear_count: true,
  wash_count: true,
  last_worn_at: true,
  last_washed_at: true,
  quality_score: true,
  is_active: true,
  is_deleted: true,
  created_at: true,
  updated_at: true
} as const;

const washHistorySelect = {
  id: true,
  wash_type: true,
  wash_date: true,
  water_temperature: true,
  notes: true,
  created_at: true
} as const;

const qualityHistorySelect = {
  id: true,
  quality_score: true,
  wear_count_at_record: true,
  wash_count_at_record: true,
  notes: true,
  recorded_at: true,
  created_at: true
} as const;

const clothWithHistorySelect = {
  ...clothSelect,
  wash_records: {
    where: {
      is_deleted: false
    },
    orderBy: {
      wash_date: "desc" as const
    },
    select: washHistorySelect
  },
  quality_history: {
    where: {
      is_deleted: false
    },
    orderBy: {
      recorded_at: "desc" as const
    },
    select: qualityHistorySelect
  }
} as const;

const clothStatsItemSelect = {
  id: true,
  name: true,
  category: true,
  fabric_type: true,
  color_primary: true,
  wear_count: true,
  quality_score: true,
  photo_urls: true
} as const;

type PersistedCloth = Prisma.ClothGetPayload<{ select: typeof clothSelect }>;
type PersistedWashHistory = Prisma.WashRecordGetPayload<{ select: typeof washHistorySelect }>;
type PersistedQualityHistory = Prisma.QualityHistoryGetPayload<{ select: typeof qualityHistorySelect }>;
type PersistedStatsCloth = Prisma.ClothGetPayload<{ select: typeof clothStatsItemSelect }>;
type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

type CanonicalWashType = "MACHINE_WASH" | "HAND_WASH" | "DRY_CLEAN";

interface WashBreakdown {
  machineWashCount: number;
  handWashCount: number;
  dryCleanCount: number;
}

export interface ClothRecord {
  id: string;
  name: string;
  category: string;
  fabric_type: string;
  color_primary: string;
  color_secondary: string | null;
  pattern: string | null;
  brand: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  occasions: string[];
  season: string[];
  size: string | null;
  care_instructions: string | null;
  photo_urls: string[];
  wear_count: number;
  wash_count: number;
  last_worn_at: string | null;
  last_washed_at: string | null;
  quality_score: number;
  created_at: string;
  updated_at: string;
}

export interface ClothHistoryRecord {
  id: string;
  wash_type: string;
  wash_date: string;
  water_temperature: string | null;
  notes: string | null;
  created_at: string;
}

export interface ClothQualityRecord {
  id: string;
  quality_score: number;
  wear_count_at_record: number;
  wash_count_at_record: number;
  notes: string | null;
  recorded_at: string;
  created_at: string;
}

export interface ClothDetails extends ClothRecord {
  wash_history: ClothHistoryRecord[];
  quality_history: ClothQualityRecord[];
}

export interface ClothStatsItem {
  id: string;
  name: string;
  category: string;
  fabric_type: string;
  color_primary: string;
  wear_count: number;
  quality_score: number;
  photo_urls: string[];
}

export interface ClothStats {
  total_clothes_count: number;
  clean_clothes_count: number;
  needs_wash_count: number;
  rarely_worn_count: number;
  total_wardrobe_value_inr: number;
  total_wardrobe_value_display: string;
  most_worn_cloth: ClothStatsItem | null;
  least_worn_cloth: ClothStatsItem | null;
}

export interface ClothListFilters {
  category?: string;
  occasion?: string;
  season?: string;
  search?: string;
}

export interface CreateClothInput {
  name: string;
  category: string;
  fabric_type: string;
  color_primary: string;
  color_secondary?: string;
  pattern?: string;
  brand?: string;
  purchase_price?: number;
  purchase_date?: Date;
  occasions: string[];
  season: string[];
  size?: string;
  care_instructions?: string;
  photo_urls: string[];
}

export interface UpdateClothInput {
  name?: string;
  category?: string;
  fabric_type?: string;
  color_primary?: string;
  color_secondary?: string;
  pattern?: string;
  brand?: string;
  purchase_price?: number;
  purchase_date?: Date;
  occasions?: string[];
  season?: string[];
  size?: string;
  care_instructions?: string;
  photo_urls?: string[];
}

export interface WearClothInput {
  worn_at?: Date;
}

export interface WashClothInput {
  wash_type: CanonicalWashType;
  wash_date?: Date;
  water_temperature?: string;
  notes?: string;
}

class ClothService {
  private toNumber(value: Prisma.Decimal | number | null): number | null {
    if (value === null) {
      return null;
    }

    if (typeof value === "number") {
      return value;
    }

    return value.toNumber();
  }

  private normalizeStringArray(values: string[] | undefined): string[] {
    if (!values) {
      return [];
    }

    return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
  }

  private normalizeFabricType(value: string): FabricTypeKey {
    const normalizedValue = value
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

    switch (normalizedValue) {
      case "POLYESTER":
      case "DENIM":
      case "COTTON":
      case "LINEN":
      case "WOOL":
      case "RAYON":
      case "SILK":
      case "KHADI":
        return normalizedValue;
      default:
        return "OTHER";
    }
  }

  private normalizeWashType(value: string): CanonicalWashType | null {
    const normalizedValue = value
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

    if (
      normalizedValue === "MACHINE_WASH" ||
      normalizedValue === "HAND_WASH" ||
      normalizedValue === "DRY_CLEAN"
    ) {
      return normalizedValue;
    }

    return null;
  }

  private calculateAgeInMonths(referenceDate: Date, asOfDate: Date): number {
    const startDate = new Date(referenceDate);
    const endDate = new Date(asOfDate);

    if (startDate > endDate) {
      return 0;
    }

    let monthDifference =
      (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
      (endDate.getUTCMonth() - startDate.getUTCMonth());

    if (endDate.getUTCDate() < startDate.getUTCDate()) {
      monthDifference -= 1;
    }

    return Math.max(monthDifference, 0);
  }

  private calculateClothQualityScore(
    cloth: {
      fabric_type: string;
      wear_count: number;
      purchase_date: Date | null;
      created_at: Date;
    },
    washBreakdown: WashBreakdown,
    asOfDate: Date
  ): number {
    const ageReference = cloth.purchase_date ?? cloth.created_at;
    const ageMonths = this.calculateAgeInMonths(ageReference, asOfDate);

    return calculateQualityScore({
      fabric: this.normalizeFabricType(cloth.fabric_type),
      wearCount: cloth.wear_count,
      machineWashCount: washBreakdown.machineWashCount,
      handWashCount: washBreakdown.handWashCount,
      dryCleanCount: washBreakdown.dryCleanCount,
      ageMonths
    });
  }

  private toClothRecord(cloth: PersistedCloth): ClothRecord {
    const qualityScore = this.toNumber(cloth.quality_score);

    return {
      id: cloth.id,
      name: cloth.name,
      category: cloth.category,
      fabric_type: cloth.fabric_type,
      color_primary: cloth.color_primary,
      color_secondary: cloth.color_secondary,
      pattern: cloth.pattern,
      brand: cloth.brand,
      purchase_price: this.toNumber(cloth.purchase_price),
      purchase_date: cloth.purchase_date ? cloth.purchase_date.toISOString() : null,
      occasions: cloth.occasions,
      season: cloth.season,
      size: cloth.size,
      care_instructions: cloth.care_instructions,
      photo_urls: cloth.photo_urls,
      wear_count: cloth.wear_count,
      wash_count: cloth.wash_count,
      last_worn_at: cloth.last_worn_at ? cloth.last_worn_at.toISOString() : null,
      last_washed_at: cloth.last_washed_at ? cloth.last_washed_at.toISOString() : null,
      quality_score: qualityScore ?? INITIAL_QUALITY_SCORE,
      created_at: cloth.created_at.toISOString(),
      updated_at: cloth.updated_at.toISOString()
    };
  }

  private toWashHistoryRecord(washRecord: PersistedWashHistory): ClothHistoryRecord {
    return {
      id: washRecord.id,
      wash_type: washRecord.wash_type,
      wash_date: washRecord.wash_date.toISOString(),
      water_temperature: washRecord.water_temperature,
      notes: washRecord.notes,
      created_at: washRecord.created_at.toISOString()
    };
  }

  private toQualityHistoryRecord(qualityHistory: PersistedQualityHistory): ClothQualityRecord {
    const qualityScore = this.toNumber(qualityHistory.quality_score);

    return {
      id: qualityHistory.id,
      quality_score: qualityScore ?? 0,
      wear_count_at_record: qualityHistory.wear_count_at_record,
      wash_count_at_record: qualityHistory.wash_count_at_record,
      notes: qualityHistory.notes,
      recorded_at: qualityHistory.recorded_at.toISOString(),
      created_at: qualityHistory.created_at.toISOString()
    };
  }

  private toClothStatsItem(cloth: PersistedStatsCloth | null): ClothStatsItem | null {
    if (!cloth) {
      return null;
    }

    const qualityScore = this.toNumber(cloth.quality_score);

    return {
      id: cloth.id,
      name: cloth.name,
      category: cloth.category,
      fabric_type: cloth.fabric_type,
      color_primary: cloth.color_primary,
      wear_count: cloth.wear_count,
      quality_score: qualityScore ?? 0,
      photo_urls: cloth.photo_urls
    };
  }

  private async getOwnedClothOrThrow(
    userId: string,
    clothId: string,
    client: PrismaClientLike = prisma
  ): Promise<PersistedCloth> {
    const cloth = await client.cloth.findFirst({
      where: {
        id: clothId,
        user_id: userId,
        is_deleted: false,
        is_active: true
      },
      select: clothSelect
    });

    if (!cloth) {
      throw new AppError("Cloth not found", 404, "CLOTH_001");
    }

    return cloth;
  }

  private async getWashBreakdown(
    client: PrismaClientLike,
    userId: string,
    clothId: string
  ): Promise<WashBreakdown> {
    const groupedRecords = await client.washRecord.groupBy({
      by: ["wash_type"],
      where: {
        cloth_id: clothId,
        user_id: userId,
        is_deleted: false
      },
      _count: {
        _all: true
      }
    });

    const washBreakdown: WashBreakdown = {
      machineWashCount: 0,
      handWashCount: 0,
      dryCleanCount: 0
    };

    for (const groupedRecord of groupedRecords) {
      const normalizedWashType = this.normalizeWashType(groupedRecord.wash_type);

      if (normalizedWashType === "MACHINE_WASH") {
        washBreakdown.machineWashCount += groupedRecord._count._all;
      }

      if (normalizedWashType === "HAND_WASH") {
        washBreakdown.handWashCount += groupedRecord._count._all;
      }

      if (normalizedWashType === "DRY_CLEAN") {
        washBreakdown.dryCleanCount += groupedRecord._count._all;
      }
    }

    return washBreakdown;
  }

  private handleServiceError(
    error: unknown,
    endpoint: string,
    userId: string,
    clothId?: string
  ): never {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error("Cloth service operation failed", {
      endpoint,
      userId,
      clothId,
      error: error instanceof Error ? error.message : "Unknown cloth service error",
      timestamp: new Date().toISOString()
    });

    throw new AppError("Unable to process cloth request", 500, "INTERNAL_500");
  }

  /**
   * Auto-tag cloth properties from image using Gemma-3 vision model
   * Detects: category, fabric, color, pattern, occasion, season
   * Used during cloth upload to pre-fill cloth details
   */
  public async tagClothFromImage(
    imageUrl: string,
    clothNameHint?: string,
    categoryHint?: string
  ): Promise<{
    category: string;
    fabric_type: string;
    color_primary: string;
    color_secondary: string | null;
    pattern: string;
    occasions: string[];
    season: string[];
  }> {
    try {
      const prompt = `${CLOTH_TAGGING_SYSTEM_PROMPT}\n\n${buildClothTaggingUserPrompt({
        clothNameHint,
        categoryHint
      })}`;

      const responseText = await callGemmaVision(imageUrl, prompt);
      const taggingResult = parseAIResponse(responseText, clothTaggingSchema);

      return {
        category: taggingResult.category || "other",
        fabric_type: taggingResult.fabric_type || "other",
        color_primary: taggingResult.color_primary || "neutral",
        color_secondary: taggingResult.color_secondary || null,
        pattern: taggingResult.pattern || "solid",
        occasions: taggingResult.occasion_suitability ?? ["casual"],
        season: taggingResult.season_suitability ?? ["all-season"]
      };
    } catch (error) {
      logger.warn("Cloth image tagging failed, using default values", {
        imageUrl,
        error: error instanceof Error ? error.message : "Unknown error"
      });

      return {
        category: "other",
        fabric_type: "other",
        color_primary: "neutral",
        color_secondary: null,
        pattern: "solid",
        occasions: ["casual"],
        season: ["all-season"]
      };
    }
  }

  public async list(
    userId: string,
    page: number,
    limit: number,
    filters: ClothListFilters = {}
  ): Promise<{ items: ClothRecord[]; total: number }> {
    try {
      const skip = (page - 1) * limit;

      const where: Prisma.ClothWhereInput = {
        user_id: userId,
        is_deleted: false,
        is_active: true
      };

      if (filters.category) {
        where.category = {
          equals: filters.category,
          mode: "insensitive"
        };
      }

      if (filters.occasion) {
        where.occasions = {
          has: filters.occasion
        };
      }

      if (filters.season) {
        where.season = {
          has: filters.season
        };
      }

      if (filters.search) {
        where.name = {
          contains: filters.search,
          mode: "insensitive"
        };
      }

      const [items, total] = await Promise.all([
        prisma.cloth.findMany({
          where,
          orderBy: {
            updated_at: "desc"
          },
          skip,
          take: limit,
          select: clothSelect
        }),
        prisma.cloth.count({
          where
        })
      ]);

      logger.info("Cloth records fetched", {
        endpoint: "cloth/list",
        userId,
        page,
        limit,
        total,
        timestamp: new Date().toISOString()
      });

      return {
        items: items.map((item) => this.toClothRecord(item)),
        total
      };
    } catch (error) {
      this.handleServiceError(error, "cloth/list", userId);
    }
  }

  public async create(
    userId: string,
    input: CreateClothInput
  ): Promise<ClothRecord> {
    try {
      const createdCloth = await prisma.$transaction(async (transactionClient) => {
        const cloth = await transactionClient.cloth.create({
          data: {
            user_id: userId,
            name: input.name,
            category: input.category,
            fabric_type: input.fabric_type,
            color_primary: input.color_primary,
            color_secondary: input.color_secondary,
            pattern: input.pattern,
            brand: input.brand,
            purchase_price: input.purchase_price,
            purchase_date: input.purchase_date,
            occasions: this.normalizeStringArray(input.occasions),
            season: this.normalizeStringArray(input.season),
            size: input.size,
            care_instructions: input.care_instructions,
            photo_urls: this.normalizeStringArray(input.photo_urls),
            quality_score: INITIAL_QUALITY_SCORE
          },
          select: clothSelect
        });

        await transactionClient.qualityHistory.create({
          data: {
            cloth_id: cloth.id,
            user_id: userId,
            quality_score: INITIAL_QUALITY_SCORE,
            wear_count_at_record: cloth.wear_count,
            wash_count_at_record: cloth.wash_count,
            notes: "Initial quality score",
            recorded_at: new Date()
          }
        });

        return cloth;
      });

      logger.info("Cloth created", {
        endpoint: "cloth/create",
        userId,
        clothId: createdCloth.id,
        timestamp: new Date().toISOString()
      });

      return this.toClothRecord(createdCloth);
    } catch (error) {
      this.handleServiceError(error, "cloth/create", userId);
    }
  }

  public async getById(userId: string, clothId: string): Promise<ClothDetails> {
    try {
      const cloth = await prisma.cloth.findFirst({
        where: {
          id: clothId,
          user_id: userId,
          is_deleted: false,
          is_active: true
        },
        select: clothWithHistorySelect
      });

      if (!cloth) {
        throw new AppError("Cloth not found", 404, "CLOTH_001");
      }

      logger.info("Cloth details fetched", {
        endpoint: "cloth/get-by-id",
        userId,
        clothId,
        timestamp: new Date().toISOString()
      });

      return {
        ...this.toClothRecord(cloth),
        wash_history: cloth.wash_records.map((washRecord) => this.toWashHistoryRecord(washRecord)),
        quality_history: cloth.quality_history.map((qualityRecord) =>
          this.toQualityHistoryRecord(qualityRecord)
        )
      };
    } catch (error) {
      this.handleServiceError(error, "cloth/get-by-id", userId, clothId);
    }
  }

  public async update(userId: string, clothId: string, input: UpdateClothInput): Promise<ClothRecord> {
    try {
      const updatedCloth = await prisma.$transaction(async (transactionClient) => {
        await this.getOwnedClothOrThrow(userId, clothId, transactionClient);

        const updateData: Prisma.ClothUpdateInput = {};

        if (input.name !== undefined) {
          updateData.name = input.name;
        }

        if (input.category !== undefined) {
          updateData.category = input.category;
        }

        if (input.fabric_type !== undefined) {
          updateData.fabric_type = input.fabric_type;
        }

        if (input.color_primary !== undefined) {
          updateData.color_primary = input.color_primary;
        }

        if (input.color_secondary !== undefined) {
          updateData.color_secondary = input.color_secondary;
        }

        if (input.pattern !== undefined) {
          updateData.pattern = input.pattern;
        }

        if (input.brand !== undefined) {
          updateData.brand = input.brand;
        }

        if (input.purchase_price !== undefined) {
          updateData.purchase_price = input.purchase_price;
        }

        if (input.purchase_date !== undefined) {
          updateData.purchase_date = input.purchase_date;
        }

        if (input.occasions !== undefined) {
          updateData.occasions = this.normalizeStringArray(input.occasions);
        }

        if (input.season !== undefined) {
          updateData.season = this.normalizeStringArray(input.season);
        }

        if (input.size !== undefined) {
          updateData.size = input.size;
        }

        if (input.care_instructions !== undefined) {
          updateData.care_instructions = input.care_instructions;
        }

        if (input.photo_urls !== undefined) {
          updateData.photo_urls = this.normalizeStringArray(input.photo_urls);
        }

        let cloth = await transactionClient.cloth.update({
          where: {
            id: clothId
          },
          data: updateData,
          select: clothSelect
        });

        if (input.fabric_type !== undefined || input.purchase_date !== undefined) {
          const washBreakdown = await this.getWashBreakdown(transactionClient, userId, cloth.id);
          const recalculatedQualityScore = this.calculateClothQualityScore(
            {
              fabric_type: cloth.fabric_type,
              wear_count: cloth.wear_count,
              purchase_date: cloth.purchase_date,
              created_at: cloth.created_at
            },
            washBreakdown,
            new Date()
          );

          cloth = await transactionClient.cloth.update({
            where: {
              id: clothId
            },
            data: {
              quality_score: recalculatedQualityScore
            },
            select: clothSelect
          });

          await transactionClient.qualityHistory.create({
            data: {
              cloth_id: cloth.id,
              user_id: userId,
              quality_score: recalculatedQualityScore,
              wear_count_at_record: cloth.wear_count,
              wash_count_at_record: cloth.wash_count,
              notes: "Quality recalculated after cloth update",
              recorded_at: new Date()
            }
          });
        }

        return cloth;
      });

      logger.info("Cloth updated", {
        endpoint: "cloth/update",
        userId,
        clothId,
        timestamp: new Date().toISOString()
      });

      return this.toClothRecord(updatedCloth);
    } catch (error) {
      this.handleServiceError(error, "cloth/update", userId, clothId);
    }
  }

  public async softDelete(userId: string, clothId: string): Promise<{ cloth_deleted: boolean }> {
    try {
      await prisma.$transaction(async (transactionClient) => {
        await this.getOwnedClothOrThrow(userId, clothId, transactionClient);

        await transactionClient.cloth.update({
          where: {
            id: clothId
          },
          data: {
            is_deleted: true,
            is_active: false
          }
        });

        await transactionClient.washRecord.updateMany({
          where: {
            cloth_id: clothId,
            user_id: userId,
            is_deleted: false
          },
          data: {
            is_deleted: true
          }
        });

        await transactionClient.qualityHistory.updateMany({
          where: {
            cloth_id: clothId,
            user_id: userId,
            is_deleted: false
          },
          data: {
            is_deleted: true
          }
        });
      });

      logger.warn("Cloth soft deleted", {
        endpoint: "cloth/delete",
        userId,
        clothId,
        timestamp: new Date().toISOString()
      });

      return {
        cloth_deleted: true
      };
    } catch (error) {
      this.handleServiceError(error, "cloth/delete", userId, clothId);
    }
  }

  public async recordWear(userId: string, clothId: string, input: WearClothInput): Promise<ClothRecord> {
    try {
      const wornAt = input.worn_at ?? new Date();

      const updatedCloth = await prisma.$transaction(async (transactionClient) => {
        const cloth = await this.getOwnedClothOrThrow(userId, clothId, transactionClient);

        const washBreakdown = await this.getWashBreakdown(transactionClient, userId, cloth.id);
        const recalculatedQualityScore = this.calculateClothQualityScore(
          {
            fabric_type: cloth.fabric_type,
            wear_count: cloth.wear_count + 1,
            purchase_date: cloth.purchase_date,
            created_at: cloth.created_at
          },
          washBreakdown,
          wornAt
        );

        const updated = await transactionClient.cloth.update({
          where: {
            id: clothId
          },
          data: {
            wear_count: {
              increment: 1
            },
            last_worn_at: wornAt,
            quality_score: recalculatedQualityScore
          },
          select: clothSelect
        });

        await transactionClient.qualityHistory.create({
          data: {
            cloth_id: clothId,
            user_id: userId,
            quality_score: recalculatedQualityScore,
            wear_count_at_record: updated.wear_count,
            wash_count_at_record: updated.wash_count,
            notes: "Wear recorded",
            recorded_at: wornAt
          }
        });

        return updated;
      });

      logger.info("Cloth wear recorded", {
        endpoint: "cloth/wear",
        userId,
        clothId,
        timestamp: new Date().toISOString()
      });

      return this.toClothRecord(updatedCloth);
    } catch (error) {
      this.handleServiceError(error, "cloth/wear", userId, clothId);
    }
  }

  public async recordWash(userId: string, clothId: string, input: WashClothInput): Promise<ClothRecord> {
    try {
      const washDate = input.wash_date ?? new Date();

      const updatedCloth = await prisma.$transaction(async (transactionClient) => {
        const cloth = await this.getOwnedClothOrThrow(userId, clothId, transactionClient);

        await transactionClient.washRecord.create({
          data: {
            cloth_id: clothId,
            user_id: userId,
            wash_type: input.wash_type,
            wash_date: washDate,
            water_temperature: input.water_temperature,
            notes: input.notes
          }
        });

        const washBreakdown = await this.getWashBreakdown(transactionClient, userId, cloth.id);
        const recalculatedQualityScore = this.calculateClothQualityScore(
          {
            fabric_type: cloth.fabric_type,
            wear_count: cloth.wear_count,
            purchase_date: cloth.purchase_date,
            created_at: cloth.created_at
          },
          washBreakdown,
          washDate
        );

        const updated = await transactionClient.cloth.update({
          where: {
            id: clothId
          },
          data: {
            wash_count: {
              increment: 1
            },
            last_washed_at: washDate,
            quality_score: recalculatedQualityScore
          },
          select: clothSelect
        });

        await transactionClient.qualityHistory.create({
          data: {
            cloth_id: clothId,
            user_id: userId,
            quality_score: recalculatedQualityScore,
            wear_count_at_record: updated.wear_count,
            wash_count_at_record: updated.wash_count,
            notes: `Wash recorded: ${input.wash_type}`,
            recorded_at: washDate
          }
        });

        return updated;
      });

      logger.info("Cloth wash recorded", {
        endpoint: "cloth/wash",
        userId,
        clothId,
        washType: input.wash_type,
        timestamp: new Date().toISOString()
      });

      return this.toClothRecord(updatedCloth);
    } catch (error) {
      this.handleServiceError(error, "cloth/wash", userId, clothId);
    }
  }

  public async getStats(userId: string): Promise<ClothStats> {
    try {
      const where: Prisma.ClothWhereInput = {
        user_id: userId,
        is_deleted: false,
        is_active: true
      };

      const [aggregateResult, wearAndWashRecords, rarelyWornCount, mostWornCloth, leastWornCloth] =
        await Promise.all([
          prisma.cloth.aggregate({
            where,
            _count: {
              _all: true
            },
            _sum: {
              purchase_price: true
            }
          }),
          prisma.cloth.findMany({
            where,
            select: {
              wear_count: true,
              wash_count: true
            }
          }),
          prisma.cloth.count({
            where: {
              ...where,
              wear_count: {
                lte: RARELY_WORN_THRESHOLD
              }
            }
          }),
          prisma.cloth.findFirst({
            where,
            orderBy: [
              {
                wear_count: "desc"
              },
              {
                updated_at: "desc"
              }
            ],
            select: clothStatsItemSelect
          }),
          prisma.cloth.findFirst({
            where,
            orderBy: [
              {
                wear_count: "asc"
              },
              {
                updated_at: "asc"
              }
            ],
            select: clothStatsItemSelect
          })
        ]);

      let cleanClothesCount = 0;
      let needsWashCount = 0;

      for (const wearAndWashRecord of wearAndWashRecords) {
        if (wearAndWashRecord.wear_count > wearAndWashRecord.wash_count) {
          needsWashCount += 1;
        } else {
          cleanClothesCount += 1;
        }
      }

      const totalWardrobeValue = aggregateResult._sum.purchase_price
        ? aggregateResult._sum.purchase_price.toNumber()
        : 0;
      const totalClothesCount = aggregateResult._count._all;

      logger.info("Cloth stats fetched", {
        endpoint: "cloth/stats",
        userId,
        totalClothesCount,
        timestamp: new Date().toISOString()
      });

      return {
        total_clothes_count: totalClothesCount,
        clean_clothes_count: cleanClothesCount,
        needs_wash_count: needsWashCount,
        rarely_worn_count: rarelyWornCount,
        total_wardrobe_value_inr: Number(totalWardrobeValue.toFixed(2)),
        total_wardrobe_value_display: INR_FORMATTER.format(totalWardrobeValue),
        most_worn_cloth: this.toClothStatsItem(mostWornCloth),
        least_worn_cloth: this.toClothStatsItem(leastWornCloth)
      };
    } catch (error) {
      this.handleServiceError(error, "cloth/stats", userId);
    }
  }
}

const clothService = new ClothService();

export default clothService;
