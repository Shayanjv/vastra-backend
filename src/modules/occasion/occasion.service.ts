import { Prisma } from "@prisma/client";
import { z } from "zod";
import { INDIAN_STATIC_OCCASIONS } from "../../config/occasion";
import prisma from "../../config/database";
import { buildOccasionContextUserPrompt, OCCASION_CONTEXT_SYSTEM_PROMPT } from "../../prompts/occasion-context.prompt";
import { callMistral, parseAIResponse } from "../../utils/ai.util";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";

const occasionContextSchema = z.object({
  dress_code: z.string().min(1),
  colors_recommended: z.array(z.string()).default([]),
  colors_to_avoid: z.array(z.string()).default([]),
  fabric_recommended: z.array(z.string()).default([]),
  accessories: z.array(z.string()).default([]),
  cultural_notes: z.string().min(1),
  formality_level: z.string().min(1)
});

const userStatusSelect = {
  id: true,
  is_active: true,
  is_deleted: true
} as const;

const occasionSelect = {
  id: true,
  user_id: true,
  occasion_type: true,
  outfit_suggestion_id: true,
  outfit_date: true,
  notes: true,
  created_at: true,
  updated_at: true
} as const;

const occasionHistorySelect = {
  ...occasionSelect,
  outfit_suggestion: {
    select: {
      id: true,
      occasion: true,
      clothes_ids: true,
      style_score: true,
      color_harmony_score: true,
      ai_explanation: true,
      date_suggested: true,
      is_worn: true,
      worn_at: true
    }
  }
} as const;

type PersistedOccasion = Prisma.OccasionGetPayload<{ select: typeof occasionSelect }>;
type PersistedOccasionWithSuggestion = Prisma.OccasionGetPayload<{ select: typeof occasionHistorySelect }>;

export interface OccasionRecord {
  id: string;
  occasion_type: string;
  outfit_suggestion_id: string | null;
  outfit_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OccasionHistoryRecord extends OccasionRecord {
  outfit_suggestion: {
    id: string;
    occasion: string;
    clothes_ids: string[];
    style_score: number;
    color_harmony_score: number;
    ai_explanation: string;
    date_suggested: string;
    is_worn: boolean;
    worn_at: string | null;
  } | null;
}

export interface OccasionHistoryFilters {
  occasion_type?: string;
  from_date?: Date;
  to_date?: Date;
}

export interface CreateOccasionInput {
  occasion_type: string;
  outfit_suggestion_id?: string;
  outfit_date: Date;
  notes?: string;
}

export interface OccasionListItem {
  id?: string;
  occasion_type: string;
  source: "STATIC" | "CUSTOM";
}

export interface OccasionContextResponse {
  dress_code: string;
  colors_recommended: string[];
  colors_to_avoid: string[];
  fabric_recommended: string[];
  accessories: string[];
  cultural_notes: string;
  formality_level: string;
}

class OccasionService {
  private toNumber(value: Prisma.Decimal | number | null): number {
    if (value === null) {
      return 0;
    }

    if (typeof value === "number") {
      return value;
    }

    return value.toNumber();
  }

  private toOccasionRecord(occasion: PersistedOccasion): OccasionRecord {
    return {
      id: occasion.id,
      occasion_type: occasion.occasion_type,
      outfit_suggestion_id: occasion.outfit_suggestion_id,
      outfit_date: occasion.outfit_date.toISOString(),
      notes: occasion.notes,
      created_at: occasion.created_at.toISOString(),
      updated_at: occasion.updated_at.toISOString()
    };
  }

  private toOccasionHistoryRecord(occasion: PersistedOccasionWithSuggestion): OccasionHistoryRecord {
    return {
      ...this.toOccasionRecord(occasion),
      outfit_suggestion: occasion.outfit_suggestion
        ? {
            id: occasion.outfit_suggestion.id,
            occasion: occasion.outfit_suggestion.occasion,
            clothes_ids: occasion.outfit_suggestion.clothes_ids,
            style_score: this.toNumber(occasion.outfit_suggestion.style_score),
            color_harmony_score: this.toNumber(occasion.outfit_suggestion.color_harmony_score),
            ai_explanation: occasion.outfit_suggestion.ai_explanation,
            date_suggested: occasion.outfit_suggestion.date_suggested.toISOString(),
            is_worn: occasion.outfit_suggestion.is_worn,
            worn_at: occasion.outfit_suggestion.worn_at
              ? occasion.outfit_suggestion.worn_at.toISOString()
              : null
          }
        : null
    };
  }

  private normalizeSearch(search: string | undefined): string | undefined {
    if (typeof search !== "string") {
      return undefined;
    }

    const trimmedSearch = search.trim();

    return trimmedSearch.length > 0 ? trimmedSearch.toLowerCase() : undefined;
  }

  private toLegacyOccasionRecord(occasion: OccasionRecord, userId: string): {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: occasion.id,
      userId,
      name: occasion.occasion_type,
      description: occasion.notes,
      createdAt: occasion.created_at,
      updatedAt: occasion.updated_at
    };
  }

  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: userStatusSelect
    });

    if (!user || user.is_deleted) {
      throw new AppError("User not found", 404, "USER_001");
    }

    if (!user.is_active) {
      throw new AppError("Unauthorized", 401, "AUTH_003");
    }
  }

  private handleServiceError(error: unknown, endpoint: string, userId: string): never {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error("Occasion service operation failed", {
      endpoint,
      userId,
      error: error instanceof Error ? error.message : "Unknown occasion service error",
      timestamp: new Date().toISOString()
    });

    throw new AppError("Unable to process occasion request", 500, "INTERNAL_500");
  }

  public async getOccasions(
    userId: string,
    search?: string
  ): Promise<{ static_occasions: string[]; custom_occasions: OccasionRecord[]; all_occasions: OccasionListItem[] }> {
    try {
      await this.ensureActiveUser(userId);

      const customOccasions = await prisma.occasion.findMany({
        where: {
          user_id: userId,
          is_deleted: false
        },
        orderBy: [
          {
            outfit_date: "desc"
          },
          {
            created_at: "desc"
          }
        ],
        select: occasionSelect
      });

      const staticOccasions = Array.from(new Set(INDIAN_STATIC_OCCASIONS));
      const normalizedSearch = this.normalizeSearch(search);

      const filteredStaticOccasions = normalizedSearch
        ? staticOccasions.filter((occasion) => occasion.toLowerCase().includes(normalizedSearch))
        : staticOccasions;

      const mappedCustomOccasions = customOccasions
        .map((occasion) => this.toOccasionRecord(occasion))
        .filter((occasion) => {
          if (!normalizedSearch) {
            return true;
          }

          return occasion.occasion_type.toLowerCase().includes(normalizedSearch);
        });

      const allOccasions: OccasionListItem[] = [
        ...filteredStaticOccasions.map((occasionType) => {
          return {
            occasion_type: occasionType,
            source: "STATIC" as const
          };
        }),
        ...mappedCustomOccasions.map((occasion) => {
          return {
            id: occasion.id,
            occasion_type: occasion.occasion_type,
            source: "CUSTOM" as const
          };
        })
      ];

      logger.info("Occasion list fetched", {
        endpoint: "occasion/list",
        userId,
        staticCount: filteredStaticOccasions.length,
        customCount: mappedCustomOccasions.length,
        timestamp: new Date().toISOString()
      });

      return {
        static_occasions: filteredStaticOccasions,
        custom_occasions: mappedCustomOccasions,
        all_occasions: allOccasions
      };
    } catch (error) {
      this.handleServiceError(error, "occasion/list", userId);
    }
  }

  public async createOccasion(userId: string, input: CreateOccasionInput): Promise<OccasionRecord> {
    try {
      await this.ensureActiveUser(userId);

      if (input.outfit_suggestion_id) {
        const linkedSuggestion = await prisma.outfitSuggestion.findFirst({
          where: {
            id: input.outfit_suggestion_id,
            user_id: userId,
            is_deleted: false
          },
          select: {
            id: true
          }
        });

        if (!linkedSuggestion) {
          throw new AppError("Outfit suggestion not found", 404, "OUTFIT_003");
        }
      }

      const createdOccasion = await prisma.occasion.create({
        data: {
          user_id: userId,
          occasion_type: input.occasion_type,
          outfit_suggestion_id: input.outfit_suggestion_id,
          outfit_date: input.outfit_date,
          notes: input.notes
        },
        select: occasionSelect
      });

      logger.info("Occasion created", {
        endpoint: "occasion/create",
        userId,
        occasionId: createdOccasion.id,
        timestamp: new Date().toISOString()
      });

      return this.toOccasionRecord(createdOccasion);
    } catch (error) {
      this.handleServiceError(error, "occasion/create", userId);
    }
  }

  public async getOccasionHistory(
    userId: string,
    page: number,
    limit: number,
    filters: OccasionHistoryFilters
  ): Promise<{ items: OccasionHistoryRecord[]; total: number }> {
    try {
      await this.ensureActiveUser(userId);

      const where: Prisma.OccasionWhereInput = {
        user_id: userId,
        is_deleted: false
      };

      const outfitDateFilter: Prisma.DateTimeFilter = {
        lte: new Date()
      };

      if (filters.from_date) {
        outfitDateFilter.gte = filters.from_date;
      }

      if (filters.to_date) {
        outfitDateFilter.lte = filters.to_date;
      }

      where.outfit_date = outfitDateFilter;

      if (filters.occasion_type) {
        where.occasion_type = {
          contains: filters.occasion_type,
          mode: "insensitive"
        };
      }

      const skip = (page - 1) * limit;

      const [historyItems, total] = await Promise.all([
        prisma.occasion.findMany({
          where,
          orderBy: {
            outfit_date: "desc"
          },
          skip,
          take: limit,
          select: occasionHistorySelect
        }),
        prisma.occasion.count({ where })
      ]);

      logger.info("Occasion history fetched", {
        endpoint: "occasion/history",
        userId,
        page,
        limit,
        total,
        timestamp: new Date().toISOString()
      });

      return {
        items: historyItems.map((item) => this.toOccasionHistoryRecord(item)),
        total
      };
    } catch (error) {
      this.handleServiceError(error, "occasion/history", userId);
    }
  }

  public async list(
    userId: string,
    page: number,
    limit: number
  ): Promise<{
    items: {
      id: string;
      userId: string;
      name: string;
      description: string | null;
      createdAt: string;
      updatedAt: string;
    }[];
    total: number;
  }> {
    try {
      const history = await this.getOccasionHistory(userId, page, limit, {});

      return {
        items: history.items.map((item) => this.toLegacyOccasionRecord(item, userId)),
        total: history.total
      };
    } catch (error) {
      this.handleServiceError(error, "occasion/legacy-list", userId);
    }
  }

  public async create(
    userId: string,
    input: { name: string; description?: string }
  ): Promise<{
    id: string;
    userId: string;
    name: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  }> {
    try {
      const createdOccasion = await this.createOccasion(userId, {
        occasion_type: input.name,
        outfit_date: new Date(),
        notes: input.description
      });

      return this.toLegacyOccasionRecord(createdOccasion, userId);
    } catch (error) {
      this.handleServiceError(error, "occasion/legacy-create", userId);
    }
  }

  public async getOccasionContext(
    occasion: string,
    region: string,
    season: string
  ): Promise<OccasionContextResponse> {
    try {
      const prompt = buildOccasionContextUserPrompt({
        occasion,
        region,
        season
      });

      const responseText = await callMistral(prompt, OCCASION_CONTEXT_SYSTEM_PROMPT);
      const parsed = parseAIResponse(responseText, occasionContextSchema);

      return {
        dress_code: parsed.dress_code,
        colors_recommended: parsed.colors_recommended ?? [],
        colors_to_avoid: parsed.colors_to_avoid ?? [],
        fabric_recommended: parsed.fabric_recommended ?? [],
        accessories: parsed.accessories ?? [],
        cultural_notes: parsed.cultural_notes,
        formality_level: parsed.formality_level
      };
    } catch (error) {
      logger.warn("Occasion context generation failed", {
        occasion,
        region,
        season,
        error: error instanceof Error ? error.message : "Unknown AI error",
        timestamp: new Date().toISOString()
      });

      return {
        dress_code: "Smart traditional or semi-formal attire based on event type",
        colors_recommended: ["Blue", "Green", "Maroon"],
        colors_to_avoid: ["Neon"],
        fabric_recommended: ["Cotton", "Linen"],
        accessories: ["Watch", "Footwear matching outfit"],
        cultural_notes: "Respect local customs and choose modest, occasion-appropriate clothing.",
        formality_level: "Medium"
      };
    }
  }
}

const occasionService = new OccasionService();

export default occasionService;
