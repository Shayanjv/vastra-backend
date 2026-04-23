import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  DEFAULT_TODAY_OCCASION,
  DEFAULT_TODAY_WEATHER_SUMMARY,
  MAX_SUGGESTED_CLOTHES,
  MIN_SUGGESTED_CLOTHES,
  OUTFIT_TODAY_CACHE_TTL_SECONDS
} from "../../config/outfit";
import prisma from "../../config/database";
import redis from "../../config/redis";
import {
  buildOutfitSuggestionUserPrompt,
  OUTFIT_SUGGESTION_SYSTEM_PROMPT
} from "../../prompts/outfit-suggestion.prompt";
import { callMistral, parseAIResponse } from "../../utils/ai.util";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { filterClothesForOutfit } from "../../utils/quality-algorithm.util";

const IST_TIMEZONE = "Asia/Kolkata";

const userProfileSelect = {
  id: true,
  city: true,
  style_preferences: true,
  is_active: true,
  is_deleted: true
} as const;

const cleanClothSelect = {
  id: true,
  name: true,
  category: true,
  fabric_type: true,
  color_primary: true,
  color_secondary: true,
  occasions: true,
  season: true,
  quality_score: true,
  wear_count: true,
  wash_count: true,
  photo_urls: true
} as const;

const outfitSuggestionSelect = {
  id: true,
  user_id: true,
  occasion: true,
  clothes_ids: true,
  style_score: true,
  color_harmony_score: true,
  ai_explanation: true,
  weather_data: true,
  date_suggested: true,
  is_worn: true,
  worn_at: true,
  is_saved: true,
  is_deleted: true,
  created_at: true,
  updated_at: true
} as const;

const savedOutfitSelect = {
  id: true,
  user_id: true,
  name: true,
  clothes_ids: true,
  occasion_tag: true,
  style_score: true,
  is_deleted: true,
  created_at: true,
  updated_at: true
} as const;

const aiSuggestionSchema = z.object({
  suggested_clothes: z.array(z.string().trim().min(1)).min(1).max(MAX_SUGGESTED_CLOTHES),
  style_score: z.coerce.number().min(0).max(100),
  color_harmony_score: z.coerce.number().min(0).max(100),
  explanation: z.string().trim().min(1).max(1200),
  occasion_context: z.string().trim().min(1).max(1200),
  weather_reason: z.string().trim().min(1).max(1200),
  color_theory: z.string().trim().min(1).max(1200),
  alternate_outfits: z
    .array(
      z.object({
        clothes_ids: z.array(z.string().trim().min(1)).min(1),
        style_score: z.coerce.number().min(0).max(100)
      })
    )
    .default([])
});

type PersistedUserProfile = Prisma.UserGetPayload<{ select: typeof userProfileSelect }>;
type PersistedCleanCloth = Prisma.ClothGetPayload<{ select: typeof cleanClothSelect }>;
type PersistedOutfitSuggestion = Prisma.OutfitSuggestionGetPayload<{ select: typeof outfitSuggestionSelect }>;
type PersistedSavedOutfit = Prisma.SavedOutfitGetPayload<{ select: typeof savedOutfitSelect }>;

export interface OutfitRecord {
  id: string;
  occasion: string;
  clothes_ids: string[];
  style_score: number;
  color_harmony_score: number;
  ai_explanation: string;
  weather_data: unknown;
  date_suggested: string;
  is_worn: boolean;
  worn_at: string | null;
  is_saved: boolean;
  created_at: string;
  updated_at: string;
  selected_clothes: OutfitClothDetail[];
}

export interface OutfitClothDetail {
  id: string;
  name: string;
  category: string;
  fabric_type: string;
  color_primary: string;
  color_secondary: string | null;
  occasions: string[];
  season: string[];
  quality_score: number;
  wear_count: number;
  wash_count: number;
  photo_urls: string[];
}

export interface OutfitHistoryFilters {
  occasion?: string;
  from_date?: Date;
  to_date?: Date;
}

export interface SuggestOutfitInput {
  occasion: string;
  weather: string | Record<string, unknown>;
  date: Date;
}

export interface OutfitWearInput {
  worn_at?: Date;
}

export interface SaveOutfitInput {
  name: string;
  clothes_ids: string[];
  occasion_tag?: string;
}

export interface SavedOutfitRecord {
  id: string;
  name: string;
  clothes_ids: string[];
  occasion_tag: string | null;
  style_score: number | null;
  created_at: string;
  updated_at: string;
}

interface AiSuggestionResult {
  clothes_ids: string[];
  style_score: number;
  color_harmony_score: number;
  explanation: string;
  fallback_used: boolean;
}

class OutfitService {
  private toNumber(value: Prisma.Decimal | number | null): number {
    if (value === null) {
      return 0;
    }

    if (typeof value === "number") {
      return value;
    }

    return value.toNumber();
  }

  private toOutfitClothDetail(cloth: PersistedCleanCloth): OutfitClothDetail {
    return {
      id: cloth.id,
      name: cloth.name,
      category: cloth.category,
      fabric_type: cloth.fabric_type,
      color_primary: cloth.color_primary,
      color_secondary: cloth.color_secondary,
      occasions: cloth.occasions,
      season: cloth.season,
      quality_score: this.toNumber(cloth.quality_score),
      wear_count: cloth.wear_count,
      wash_count: cloth.wash_count,
      photo_urls: cloth.photo_urls
    };
  }

  private toOutfitRecord(
    suggestion: PersistedOutfitSuggestion,
    selectedClothes: OutfitClothDetail[]
  ): OutfitRecord {
    return {
      id: suggestion.id,
      occasion: suggestion.occasion,
      clothes_ids: suggestion.clothes_ids,
      style_score: this.toNumber(suggestion.style_score),
      color_harmony_score: this.toNumber(suggestion.color_harmony_score),
      ai_explanation: suggestion.ai_explanation,
      weather_data: suggestion.weather_data,
      date_suggested: suggestion.date_suggested.toISOString(),
      is_worn: suggestion.is_worn,
      worn_at: suggestion.worn_at ? suggestion.worn_at.toISOString() : null,
      is_saved: suggestion.is_saved,
      created_at: suggestion.created_at.toISOString(),
      updated_at: suggestion.updated_at.toISOString(),
      selected_clothes: selectedClothes
    };
  }

  private toSavedOutfitRecord(savedOutfit: PersistedSavedOutfit): SavedOutfitRecord {
    return {
      id: savedOutfit.id,
      name: savedOutfit.name,
      clothes_ids: savedOutfit.clothes_ids,
      occasion_tag: savedOutfit.occasion_tag,
      style_score: savedOutfit.style_score ? this.toNumber(savedOutfit.style_score) : null,
      created_at: savedOutfit.created_at.toISOString(),
      updated_at: savedOutfit.updated_at.toISOString()
    };
  }

  private toLegacyOutfitRecord(savedOutfit: PersistedSavedOutfit): {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: savedOutfit.id,
      userId: savedOutfit.user_id,
      name: savedOutfit.name,
      description: savedOutfit.occasion_tag,
      createdAt: savedOutfit.created_at.toISOString(),
      updatedAt: savedOutfit.updated_at.toISOString()
    };
  }

  private normalizeStringArray(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
  }

  private getIstDateKey(date: Date): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: IST_TIMEZONE
    }).format(date);
  }

  private getIstDayRange(date: Date): { dateKey: string; start: Date; end: Date } {
    const dateKey = this.getIstDateKey(date);
    const start = new Date(`${dateKey}T00:00:00+05:30`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    return {
      dateKey,
      start,
      end
    };
  }

  private buildTodayCacheKey(userId: string, dateKey: string): string {
    return `outfit:today:${userId}:${dateKey}`;
  }

  private async getCached<T>(cacheKey: string): Promise<T | null> {
    if (redis.status !== "ready") {
      return null;
    }

    try {
      const cachedValue = await redis.get(cacheKey);

      if (!cachedValue) {
        return null;
      }

      return JSON.parse(cachedValue) as T;
    } catch (error) {
      logger.warn("Outfit cache read failed", {
        cacheKey,
        error: error instanceof Error ? error.message : "Unknown cache read error",
        timestamp: new Date().toISOString()
      });

      return null;
    }
  }

  private async setCached(cacheKey: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (redis.status !== "ready") {
      return;
    }

    try {
      await redis.set(cacheKey, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      logger.warn("Outfit cache write failed", {
        cacheKey,
        error: error instanceof Error ? error.message : "Unknown cache write error",
        timestamp: new Date().toISOString()
      });
    }
  }

  private async deleteCached(cacheKey: string): Promise<void> {
    if (redis.status !== "ready") {
      return;
    }

    try {
      await redis.del(cacheKey);
    } catch (error) {
      logger.warn("Outfit cache delete failed", {
        cacheKey,
        error: error instanceof Error ? error.message : "Unknown cache delete error",
        timestamp: new Date().toISOString()
      });
    }
  }

  private async invalidateTodayCache(userId: string, referenceDate: Date): Promise<void> {
    const { dateKey } = this.getIstDayRange(referenceDate);
    const cacheKey = this.buildTodayCacheKey(userId, dateKey);

    await this.deleteCached(cacheKey);
  }

  private async getActiveUserOrThrow(userId: string): Promise<PersistedUserProfile> {
    const user = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: userProfileSelect
    });

    if (!user || user.is_deleted) {
      throw new AppError("User not found", 404, "USER_001");
    }

    if (!user.is_active) {
      throw new AppError("Unauthorized", 401, "AUTH_003");
    }

    return user;
  }

  private async getCleanClothes(userId: string, weatherSummary?: string): Promise<PersistedCleanCloth[]> {
    /**
     * HYBRID ALGORITHM STEP 1: Fetch all active clothes
     * Pre-filter dirty clothes based on fabric-specific auto-laundry thresholds
     */
    const clothes = await prisma.cloth.findMany({
      where: {
        user_id: userId,
        is_deleted: false,
        is_active: true
      },
      orderBy: [
        {
          quality_score: "desc"
        },
        {
          wear_count: "asc"
        },
        {
          created_at: "asc"
        }
      ],
      select: cleanClothSelect
    });

    /**
     * HYBRID ALGORITHM STEP 2: Algorithmic pre-filtering
     * Remove dirty clothes (exceed auto-laundry threshold for fabric)
     * Remove weather-inappropriate fabrics (optional if weather provided)
     * Only clean clothes sent to AI for outfit suggestion
     */
    const temperatureFromWeather = weatherSummary
      ? Number((weatherSummary.match(/(-?\d+(?:\.\d+)?)\s*°?c/i)?.[1] ?? "30").trim())
      : 30;

    const filteredClothes = filterClothesForOutfit(clothes, {
      temp: Number.isFinite(temperatureFromWeather) ? temperatureFromWeather : 30
    });

    logger.info("Pre-filtered clean clothes for outfit", {
      userId,
      totalClothes: clothes.length,
      afterAutoLaundryFilter: filteredClothes.length,
      weatherSummary: weatherSummary ?? "N/A"
    });

    return filteredClothes;
  }

  private serializeWeatherInput(
    weather: string | Record<string, unknown>
  ): { weatherSummary: string; weatherData: Prisma.InputJsonValue } {
    if (typeof weather === "string") {
      return {
        weatherSummary: weather,
        weatherData: {
          summary: weather
        }
      };
    }

    const summaryValue = weather["summary"];
    const conditionValue = weather["condition"];
    const temperatureValue = weather["temperature_c"];
    const humidityValue = weather["humidity"];
    const rainProbabilityValue = weather["rain_probability"];

    const summaryFromWeather = typeof summaryValue === "string" ? summaryValue : undefined;
    const conditionFromWeather = typeof conditionValue === "string" ? conditionValue : undefined;
    const temperatureFromWeather =
      typeof temperatureValue === "number" ? `${temperatureValue}C` : undefined;
    const humidityFromWeather =
      typeof humidityValue === "number" ? `${humidityValue}% humidity` : undefined;
    const rainProbabilityFromWeather =
      typeof rainProbabilityValue === "number"
        ? `${rainProbabilityValue}% rain probability`
        : undefined;

    const weatherSummary = [
      summaryFromWeather,
      conditionFromWeather,
      temperatureFromWeather,
      humidityFromWeather,
      rainProbabilityFromWeather
    ]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(", ");

    return {
      weatherSummary: weatherSummary.length > 0 ? weatherSummary : DEFAULT_TODAY_WEATHER_SUMMARY,
      weatherData: weather as Prisma.InputJsonValue
    };
  }

  private buildCleanClothesPromptPayload(cleanClothes: PersistedCleanCloth[]): string {
    const promptPayload = cleanClothes.map((cloth) => {
      return {
        id: cloth.id,
        name: cloth.name,
        category: cloth.category,
        fabric_type: cloth.fabric_type,
        color_primary: cloth.color_primary,
        color_secondary: cloth.color_secondary,
        occasions: cloth.occasions,
        season: cloth.season,
        quality_score: this.toNumber(cloth.quality_score),
        wear_count: cloth.wear_count,
        wash_count: cloth.wash_count
      };
    });

    return JSON.stringify(promptPayload);
  }

  private async generateAiSuggestion(systemPrompt: string, userPrompt: string, cleanClothes: PersistedCleanCloth[]): Promise<AiSuggestionResult> {
    /**
     * NVIDIA NIM Integration: Use Mistral Large 3 for outfit suggestions
     * Fallback to Mistral API if NVIDIA credits exhausted
     */
    let lastError: unknown = null;

    try {
      const responseText = await callMistral(userPrompt, systemPrompt);
      const parsedSuggestion = parseAIResponse(responseText, aiSuggestionSchema);

      const cleanClothIds = new Set(cleanClothes.map((cloth) => cloth.id));
      const normalizedAiIds = this.normalizeStringArray(parsedSuggestion.suggested_clothes).filter((clothId) =>
        cleanClothIds.has(clothId)
      );

      if (normalizedAiIds.length < MIN_SUGGESTED_CLOTHES) {
        throw new Error("NVIDIA NIM returned invalid cloth IDs");
      }

      return {
        clothes_ids: normalizedAiIds.slice(0, MAX_SUGGESTED_CLOTHES),
        style_score: Number(parsedSuggestion.style_score.toFixed(2)),
        color_harmony_score: Number(parsedSuggestion.color_harmony_score.toFixed(2)),
        explanation: `${parsedSuggestion.explanation} ${parsedSuggestion.occasion_context} ${parsedSuggestion.weather_reason}`,
        fallback_used: false
      };
    } catch (error) {
      lastError = error;

      logger.warn("Mistral suggestion failed, using deterministic fallback", {
        endpoint: "outfit/ai-suggest",
        error: error instanceof Error ? error.message : "Unknown AI error",
        timestamp: new Date().toISOString()
      });
    }

    // DETERMINISTIC FALLBACK: If both NVIDIA NIM and Mistral fail
    logger.warn("Using deterministic outfit suggestion (AI unavailable)", {
      endpoint: "outfit/ai-suggest",
      code: "OUTFIT_002",
      lastError: lastError instanceof Error ? lastError.message : "Unknown error",
      timestamp: new Date().toISOString()
    });

    const fallbackClothes = [...cleanClothes]
      .sort((first, second) => {
        const qualityDifference = this.toNumber(second.quality_score) - this.toNumber(first.quality_score);

        if (qualityDifference !== 0) {
          return qualityDifference;
        }

        return first.wear_count - second.wear_count;
      })
      .slice(0, Math.min(MAX_SUGGESTED_CLOTHES, 3));

    const fallbackClothesIds = fallbackClothes.map((cloth) => cloth.id);
    const averageQualityScore =
      fallbackClothes.reduce((total, cloth) => total + this.toNumber(cloth.quality_score), 0) /
      Math.max(fallbackClothes.length, 1);

    const dominantColors = new Set(fallbackClothes.map((cloth) => cloth.color_primary.toLowerCase())).size;
    const fallbackColorHarmony = Math.max(65, Math.min(92, 88 - Math.max(dominantColors - 2, 0) * 6));
    const fallbackStyleScore = Math.max(68, Math.min(95, Math.round(averageQualityScore * 0.9)));

    return {
      clothes_ids: fallbackClothesIds,
      style_score: fallbackStyleScore,
      color_harmony_score: fallbackColorHarmony,
      explanation:
        "This recommendation was generated from your clean wardrobe based on fabric quality, occasion suitability, weather practicality, and culturally appropriate Indian styling with balanced color harmony.",
      fallback_used: true
    };
  }

  private async fetchSelectedClothes(
    userId: string,
    clothesIds: string[]
  ): Promise<OutfitClothDetail[]> {
    const uniqueClothesIds = this.normalizeStringArray(clothesIds);

    if (uniqueClothesIds.length === 0) {
      return [];
    }

    const selectedClothes = await prisma.cloth.findMany({
      where: {
        user_id: userId,
        id: {
          in: uniqueClothesIds
        },
        is_deleted: false,
        is_active: true
      },
      select: cleanClothSelect
    });

    const selectedClothesMap = new Map(selectedClothes.map((cloth) => [cloth.id, cloth]));

    return uniqueClothesIds
      .map((clothId) => selectedClothesMap.get(clothId))
      .filter((cloth): cloth is PersistedCleanCloth => Boolean(cloth))
      .map((cloth) => this.toOutfitClothDetail(cloth));
  }

  private async getLatestOccasionType(userId: string): Promise<string> {
    const latestOccasion = await prisma.occasion.findFirst({
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
      select: {
        occasion_type: true
      }
    });

    return latestOccasion?.occasion_type ?? DEFAULT_TODAY_OCCASION;
  }

  private handleServiceError(error: unknown, endpoint: string, userId: string): never {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error("Outfit service operation failed", {
      endpoint,
      userId,
      error: error instanceof Error ? error.message : "Unknown outfit service error",
      timestamp: new Date().toISOString()
    });

    throw new AppError("Unable to process outfit request", 500, "INTERNAL_500");
  }

  public async suggestOutfit(userId: string, input: SuggestOutfitInput): Promise<OutfitRecord> {
    try {
      const user = await this.getActiveUserOrThrow(userId);
      
      const { weatherData, weatherSummary } = this.serializeWeatherInput(input.weather);
      
      // Get clean clothes with hybrid algorithm pre-filtering
      const cleanClothes = await this.getCleanClothes(userId, weatherSummary);

      if (cleanClothes.length === 0) {
        throw new AppError("No clean clothes available", 400, "OUTFIT_001");
      }

      const userPrompt = buildOutfitSuggestionUserPrompt({
        clean_clothes: this.buildCleanClothesPromptPayload(cleanClothes),
        occasion: input.occasion,
        weather: {
          temp: Number((weatherSummary.match(/(-?\d+(?:\.\d+)?)\s*°?c/i)?.[1] ?? "30").trim()) || 30,
          condition: weatherSummary,
          humidity: Number((weatherSummary.match(/(\d+(?:\.\d+)?)\s*%/i)?.[1] ?? "60").trim()) || 60
        },
        user_preferences: {
          skin_tone: "medium",
          style: user.style_preferences.join(", ") || "balanced"
        },
        city: user.city ?? "India"
      });

      const aiSuggestion = await this.generateAiSuggestion(OUTFIT_SUGGESTION_SYSTEM_PROMPT, userPrompt, cleanClothes);
      const selectedClothes = await this.fetchSelectedClothes(userId, aiSuggestion.clothes_ids);

      if (selectedClothes.length < MIN_SUGGESTED_CLOTHES) {
        throw new AppError("No clean clothes available", 400, "OUTFIT_001");
      }

      const createdSuggestion = await prisma.outfitSuggestion.create({
        data: {
          user_id: userId,
          occasion: input.occasion,
          clothes_ids: selectedClothes.map((cloth) => cloth.id),
          style_score: aiSuggestion.style_score,
          color_harmony_score: aiSuggestion.color_harmony_score,
          ai_explanation: aiSuggestion.explanation,
          weather_data: weatherData,
          date_suggested: input.date
        },
        select: outfitSuggestionSelect
      });

      await this.invalidateTodayCache(userId, input.date);

      logger.info("Outfit suggestion created", {
        endpoint: "outfit/suggest",
        userId,
        outfitSuggestionId: createdSuggestion.id,
        fallbackUsed: aiSuggestion.fallback_used,
        timestamp: new Date().toISOString()
      });

      return this.toOutfitRecord(createdSuggestion, selectedClothes);
    } catch (error) {
      this.handleServiceError(error, "outfit/suggest", userId);
    }
  }

  public async getTodaySuggestion(userId: string): Promise<OutfitRecord> {
    try {
      await this.getActiveUserOrThrow(userId);

      const now = new Date();
      const { dateKey, start, end } = this.getIstDayRange(now);
      const cacheKey = this.buildTodayCacheKey(userId, dateKey);
      const cachedSuggestion = await this.getCached<OutfitRecord>(cacheKey);

      if (cachedSuggestion) {
        logger.info("Today outfit suggestion returned from cache", {
          endpoint: "outfit/today",
          userId,
          cacheKey,
          timestamp: new Date().toISOString()
        });

        return cachedSuggestion;
      }

      let suggestion = await prisma.outfitSuggestion.findFirst({
        where: {
          user_id: userId,
          is_deleted: false,
          date_suggested: {
            gte: start,
            lt: end
          }
        },
        orderBy: {
          date_suggested: "desc"
        },
        select: outfitSuggestionSelect
      });

      let responseRecord: OutfitRecord;

      if (!suggestion) {
        const suggestedOccasion = await this.getLatestOccasionType(userId);

        responseRecord = await this.suggestOutfit(userId, {
          occasion: suggestedOccasion,
          weather: DEFAULT_TODAY_WEATHER_SUMMARY,
          date: now
        });
      } else {
        const selectedClothes = await this.fetchSelectedClothes(userId, suggestion.clothes_ids);
        responseRecord = this.toOutfitRecord(suggestion, selectedClothes);
      }

      await this.setCached(cacheKey, responseRecord, OUTFIT_TODAY_CACHE_TTL_SECONDS);

      logger.info("Today outfit suggestion fetched", {
        endpoint: "outfit/today",
        userId,
        cacheKey,
        timestamp: new Date().toISOString()
      });

      return responseRecord;
    } catch (error) {
      this.handleServiceError(error, "outfit/today", userId);
    }
  }

  public async getHistory(
    userId: string,
    page: number,
    limit: number,
    filters: OutfitHistoryFilters
  ): Promise<{ items: OutfitRecord[]; total: number }> {
    try {
      await this.getActiveUserOrThrow(userId);

      const where: Prisma.OutfitSuggestionWhereInput = {
        user_id: userId,
        is_deleted: false
      };

      if (filters.occasion) {
        where.occasion = {
          contains: filters.occasion,
          mode: "insensitive"
        };
      }

      if (filters.from_date || filters.to_date) {
        where.date_suggested = {};

        if (filters.from_date) {
          where.date_suggested.gte = filters.from_date;
        }

        if (filters.to_date) {
          where.date_suggested.lte = filters.to_date;
        }
      }

      const skip = (page - 1) * limit;

      const [historyItems, total] = await Promise.all([
        prisma.outfitSuggestion.findMany({
          where,
          orderBy: {
            date_suggested: "desc"
          },
          skip,
          take: limit,
          select: outfitSuggestionSelect
        }),
        prisma.outfitSuggestion.count({ where })
      ]);

      const allClothesIds = this.normalizeStringArray(historyItems.flatMap((item) => item.clothes_ids));
      const clothesDetails = await this.fetchSelectedClothes(userId, allClothesIds);
      const clothesMap = new Map(clothesDetails.map((cloth) => [cloth.id, cloth]));

      const mappedItems = historyItems.map((historyItem) => {
        const selectedClothes = historyItem.clothes_ids
          .map((clothId) => clothesMap.get(clothId))
          .filter((cloth): cloth is OutfitClothDetail => Boolean(cloth));

        return this.toOutfitRecord(historyItem, selectedClothes);
      });

      logger.info("Outfit history fetched", {
        endpoint: "outfit/history",
        userId,
        page,
        limit,
        total,
        timestamp: new Date().toISOString()
      });

      return {
        items: mappedItems,
        total
      };
    } catch (error) {
      this.handleServiceError(error, "outfit/history", userId);
    }
  }

  public async markOutfitAsWorn(
    userId: string,
    outfitId: string,
    input: OutfitWearInput
  ): Promise<OutfitRecord> {
    try {
      const wornAt = input.worn_at ?? new Date();

      const updatedSuggestion = await prisma.$transaction(async (transactionClient) => {
        const suggestion = await transactionClient.outfitSuggestion.findFirst({
          where: {
            id: outfitId,
            user_id: userId,
            is_deleted: false
          },
          select: outfitSuggestionSelect
        });

        if (!suggestion) {
          throw new AppError("Outfit suggestion not found", 404, "OUTFIT_003");
        }

        const uniqueClothIds = this.normalizeStringArray(suggestion.clothes_ids);

        if (uniqueClothIds.length > 0) {
          const updatedClothResult = await transactionClient.cloth.updateMany({
            where: {
              id: {
                in: uniqueClothIds
              },
              user_id: userId,
              is_deleted: false,
              is_active: true
            },
            data: {
              wear_count: {
                increment: 1
              },
              last_worn_at: wornAt
            }
          });

          if (updatedClothResult.count !== uniqueClothIds.length) {
            throw new AppError("Cloth not found", 404, "CLOTH_001");
          }
        }

        return transactionClient.outfitSuggestion.update({
          where: {
            id: suggestion.id
          },
          data: {
            is_worn: true,
            worn_at: wornAt
          },
          select: outfitSuggestionSelect
        });
      });

      const selectedClothes = await this.fetchSelectedClothes(userId, updatedSuggestion.clothes_ids);

      await this.invalidateTodayCache(userId, wornAt);

      logger.info("Outfit marked as worn", {
        endpoint: "outfit/wear",
        userId,
        outfitId,
        timestamp: new Date().toISOString()
      });

      return this.toOutfitRecord(updatedSuggestion, selectedClothes);
    } catch (error) {
      this.handleServiceError(error, "outfit/wear", userId);
    }
  }

  public async saveOutfit(userId: string, input: SaveOutfitInput): Promise<SavedOutfitRecord> {
    try {
      await this.getActiveUserOrThrow(userId);

      const uniqueClothesIds = this.normalizeStringArray(input.clothes_ids);

      const ownedClothesCount = await prisma.cloth.count({
        where: {
          user_id: userId,
          id: {
            in: uniqueClothesIds
          },
          is_deleted: false,
          is_active: true
        }
      });

      if (ownedClothesCount !== uniqueClothesIds.length) {
        throw new AppError("Cloth not found", 404, "CLOTH_001");
      }

      const savedOutfit = await prisma.savedOutfit.create({
        data: {
          user_id: userId,
          name: input.name,
          clothes_ids: uniqueClothesIds,
          occasion_tag: input.occasion_tag
        },
        select: savedOutfitSelect
      });

      logger.info("Outfit combination saved", {
        endpoint: "outfit/save",
        userId,
        savedOutfitId: savedOutfit.id,
        timestamp: new Date().toISOString()
      });

      return this.toSavedOutfitRecord(savedOutfit);
    } catch (error) {
      this.handleServiceError(error, "outfit/save", userId);
    }
  }

  public async getSavedOutfits(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ items: SavedOutfitRecord[]; total: number }> {
    try {
      await this.getActiveUserOrThrow(userId);

      const skip = (page - 1) * limit;

      const [savedOutfits, total] = await Promise.all([
        prisma.savedOutfit.findMany({
          where: {
            user_id: userId,
            is_deleted: false
          },
          orderBy: {
            updated_at: "desc"
          },
          skip,
          take: limit,
          select: savedOutfitSelect
        }),
        prisma.savedOutfit.count({
          where: {
            user_id: userId,
            is_deleted: false
          }
        })
      ]);

      logger.info("Saved outfits fetched", {
        endpoint: "outfit/saved-list",
        userId,
        page,
        limit,
        total,
        timestamp: new Date().toISOString()
      });

      return {
        items: savedOutfits.map((savedOutfit) => this.toSavedOutfitRecord(savedOutfit)),
        total
      };
    } catch (error) {
      this.handleServiceError(error, "outfit/saved-list", userId);
    }
  }

  public async deleteSavedOutfit(userId: string, savedOutfitId: string): Promise<{ deleted: boolean }> {
    try {
      await this.getActiveUserOrThrow(userId);

      const updateResult = await prisma.savedOutfit.updateMany({
        where: {
          id: savedOutfitId,
          user_id: userId,
          is_deleted: false
        },
        data: {
          is_deleted: true
        }
      });

      if (updateResult.count === 0) {
        throw new AppError("Saved outfit not found", 404, "OUTFIT_003");
      }

      logger.warn("Saved outfit soft deleted", {
        endpoint: "outfit/saved-delete",
        userId,
        savedOutfitId,
        timestamp: new Date().toISOString()
      });

      return {
        deleted: true
      };
    } catch (error) {
      this.handleServiceError(error, "outfit/saved-delete", userId);
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
      const savedOutfits = await this.getSavedOutfits(userId, page, limit);

      return {
        items: savedOutfits.items.map((item) => {
          return {
            id: item.id,
            userId,
            name: item.name,
            description: item.occasion_tag,
            createdAt: item.created_at,
            updatedAt: item.updated_at
          };
        }),
        total: savedOutfits.total
      };
    } catch (error) {
      this.handleServiceError(error, "outfit/legacy-list", userId);
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
      const savedOutfit = await prisma.savedOutfit.create({
        data: {
          user_id: userId,
          name: input.name,
          occasion_tag: input.description,
          clothes_ids: []
        },
        select: savedOutfitSelect
      });

      return this.toLegacyOutfitRecord(savedOutfit);
    } catch (error) {
      this.handleServiceError(error, "outfit/legacy-create", userId);
    }
  }
}

const outfitService = new OutfitService();

export default outfitService;
