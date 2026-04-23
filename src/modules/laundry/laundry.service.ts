import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import {
  LAUNDRY_DEFAULT_FABRIC_KEY,
  LAUNDRY_FABRIC_CARE_TIPS,
  LAUNDRY_QUEUE_DUE_DAYS_THRESHOLD,
  LAUNDRY_QUEUE_OVERDUE_DAYS_THRESHOLD,
  LAUNDRY_QUEUE_SOON_DAYS_THRESHOLD,
  LAUNDRY_QUEUE_OVERDUE_WEAR_THRESHOLD,
  LAUNDRY_QUEUE_SOON_WEAR_THRESHOLD,
  LAUNDRY_QUEUE_STATUS_WEIGHT,
  LAUNDRY_QUEUE_DUE_WEAR_THRESHOLD,
  type FabricCareTips,
  type LaundryQueueStatus
} from "../../config/laundry";
import prisma from "../../config/database";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { calculateQualityScore, type FabricTypeKey } from "../../utils/quality-algorithm.util";

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

const userStatusSelect = {
  id: true,
  is_active: true,
  is_deleted: true
} as const;

const clothQueueSelect = {
  id: true,
  user_id: true,
  name: true,
  category: true,
  fabric_type: true,
  color_primary: true,
  photo_urls: true,
  wear_count: true,
  wash_count: true,
  purchase_date: true,
  quality_score: true,
  created_at: true,
  updated_at: true,
  last_washed_at: true,
  is_deleted: true,
  is_active: true
} as const;

const washHistorySelect = {
  id: true,
  cloth_id: true,
  wash_type: true,
  wash_date: true,
  water_temperature: true,
  notes: true,
  created_at: true,
  cloth: {
    select: {
      id: true,
      name: true,
      category: true,
      fabric_type: true,
      color_primary: true,
      photo_urls: true
    }
  }
} as const;

const updatedClothSelect = {
  id: true,
  user_id: true,
  name: true,
  category: true,
  fabric_type: true,
  color_primary: true,
  photo_urls: true,
  wear_count: true,
  wash_count: true,
  quality_score: true,
  last_washed_at: true,
  updated_at: true
} as const;

type PersistedQueueCloth = Prisma.ClothGetPayload<{ select: typeof clothQueueSelect }>;
type PersistedUpdatedCloth = Prisma.ClothGetPayload<{ select: typeof updatedClothSelect }>;
type PersistedWashHistory = Prisma.WashRecordGetPayload<{ select: typeof washHistorySelect }>;
type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

type CanonicalWashType = "MACHINE_WASH" | "HAND_WASH" | "DRY_CLEAN";

interface WashBreakdown {
  machineWashCount: number;
  handWashCount: number;
  dryCleanCount: number;
}

export interface LaundryRecord {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LaundryQueueItem {
  cloth_id: string;
  cloth_name: string;
  category: string;
  fabric_type: string;
  color_primary: string;
  photo_urls: string[];
  quality_score: number;
  wear_count_since_wash: number;
  days_since_last_wash: number;
  status: LaundryQueueStatus;
  urgency_score: number;
  last_washed_at: string | null;
}

export interface LaundryHistoryItem {
  id: string;
  cloth_id: string;
  cloth_name: string;
  category: string;
  fabric_type: string;
  color_primary: string;
  photo_urls: string[];
  wash_type: string;
  wash_date: string;
  water_temperature: string | null;
  notes: string | null;
  created_at: string;
}

export interface MarkWashedInput {
  cloth_id: string;
  wash_type: CanonicalWashType;
  water_temperature?: string;
  notes?: string;
}

export interface LaundryHistoryFilters {
  cloth_id?: string;
  from_date?: Date;
  to_date?: Date;
}

export interface LaundryUpdatedCloth {
  id: string;
  name: string;
  category: string;
  fabric_type: string;
  color_primary: string;
  photo_urls: string[];
  wear_count: number;
  wash_count: number;
  quality_score: number;
  last_washed_at: string | null;
  updated_at: string;
}

export interface LaundryStats {
  total_washed_this_week: number;
  total_overdue: number;
  total_in_queue: number;
  average_washes_per_month: number;
  compare_to_last_week: {
    current_week_washes: number;
    last_week_washes: number;
    difference: number;
    trend: "up" | "down" | "same";
    percentage_change: number;
  };
}

export interface LaundryFabricTipsResponse extends FabricCareTips {
  requested_fabric: string;
  matched_fabric: string;
}

class LaundryService {
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

  private normalizeFabricTipKey(value: string): string {
    const normalizedValue = value
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

    return normalizedValue.length > 0 ? normalizedValue : LAUNDRY_DEFAULT_FABRIC_KEY;
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

  private calculateDaysSinceLastWash(lastWashAt: Date | null, createdAt: Date, now: Date): number {
    const referenceDate = lastWashAt ?? createdAt;
    const timeDifference = now.getTime() - referenceDate.getTime();

    return Math.max(Math.floor(timeDifference / ONE_DAY_IN_MS), 0);
  }

  private calculateWearCountSinceWash(cloth: { wear_count: number; wash_count: number }): number {
    return Math.max(cloth.wear_count - cloth.wash_count, 0);
  }

  private resolveQueueStatus(
    wearCountSinceWash: number,
    daysSinceLastWash: number,
    includeSoon: boolean
  ): LaundryQueueStatus | null {
    if (
      wearCountSinceWash >= LAUNDRY_QUEUE_OVERDUE_WEAR_THRESHOLD ||
      daysSinceLastWash >= LAUNDRY_QUEUE_OVERDUE_DAYS_THRESHOLD
    ) {
      return "overdue";
    }

    if (
      wearCountSinceWash >= LAUNDRY_QUEUE_DUE_WEAR_THRESHOLD ||
      daysSinceLastWash >= LAUNDRY_QUEUE_DUE_DAYS_THRESHOLD
    ) {
      return "due";
    }

    if (
      includeSoon &&
      (wearCountSinceWash >= LAUNDRY_QUEUE_SOON_WEAR_THRESHOLD ||
        daysSinceLastWash >= LAUNDRY_QUEUE_SOON_DAYS_THRESHOLD)
    ) {
      return "soon";
    }

    return null;
  }

  private calculateUrgencyScore(
    status: LaundryQueueStatus,
    wearCountSinceWash: number,
    daysSinceLastWash: number
  ): number {
    return (
      LAUNDRY_QUEUE_STATUS_WEIGHT[status] +
      wearCountSinceWash * 12 +
      daysSinceLastWash * 4
    );
  }

  private toQueueItem(
    cloth: PersistedQueueCloth,
    status: LaundryQueueStatus,
    wearCountSinceWash: number,
    daysSinceLastWash: number
  ): LaundryQueueItem {
    return {
      cloth_id: cloth.id,
      cloth_name: cloth.name,
      category: cloth.category,
      fabric_type: cloth.fabric_type,
      color_primary: cloth.color_primary,
      photo_urls: cloth.photo_urls,
      quality_score: this.toNumber(cloth.quality_score),
      wear_count_since_wash: wearCountSinceWash,
      days_since_last_wash: daysSinceLastWash,
      status,
      urgency_score: this.calculateUrgencyScore(status, wearCountSinceWash, daysSinceLastWash),
      last_washed_at: cloth.last_washed_at ? cloth.last_washed_at.toISOString() : null
    };
  }

  private toHistoryItem(washRecord: PersistedWashHistory): LaundryHistoryItem {
    return {
      id: washRecord.id,
      cloth_id: washRecord.cloth_id,
      cloth_name: washRecord.cloth.name,
      category: washRecord.cloth.category,
      fabric_type: washRecord.cloth.fabric_type,
      color_primary: washRecord.cloth.color_primary,
      photo_urls: washRecord.cloth.photo_urls,
      wash_type: washRecord.wash_type,
      wash_date: washRecord.wash_date.toISOString(),
      water_temperature: washRecord.water_temperature,
      notes: washRecord.notes,
      created_at: washRecord.created_at.toISOString()
    };
  }

  private toUpdatedCloth(updatedCloth: PersistedUpdatedCloth): LaundryUpdatedCloth {
    return {
      id: updatedCloth.id,
      name: updatedCloth.name,
      category: updatedCloth.category,
      fabric_type: updatedCloth.fabric_type,
      color_primary: updatedCloth.color_primary,
      photo_urls: updatedCloth.photo_urls,
      wear_count: updatedCloth.wear_count,
      wash_count: updatedCloth.wash_count,
      quality_score: this.toNumber(updatedCloth.quality_score),
      last_washed_at: updatedCloth.last_washed_at ? updatedCloth.last_washed_at.toISOString() : null,
      updated_at: updatedCloth.updated_at.toISOString()
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

  private async getOwnedClothOrThrow(
    userId: string,
    clothId: string,
    client: PrismaClientLike = prisma
  ): Promise<PersistedQueueCloth> {
    const cloth = await client.cloth.findFirst({
      where: {
        id: clothId,
        user_id: userId,
        is_deleted: false,
        is_active: true
      },
      select: clothQueueSelect
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

  private async buildLaundryQueue(userId: string, includeSoon: boolean): Promise<LaundryQueueItem[]> {
    const clothes = await prisma.cloth.findMany({
      where: {
        user_id: userId,
        is_deleted: false,
        is_active: true
      },
      select: clothQueueSelect
    });

    const now = new Date();

    const queueItems = clothes
      .map((cloth): LaundryQueueItem | null => {
        const daysSinceLastWash = this.calculateDaysSinceLastWash(cloth.last_washed_at, cloth.created_at, now);
        const wearCountSinceWash = this.calculateWearCountSinceWash(cloth);
        const status = this.resolveQueueStatus(wearCountSinceWash, daysSinceLastWash, includeSoon);

        if (!status) {
          return null;
        }

        return this.toQueueItem(cloth, status, wearCountSinceWash, daysSinceLastWash);
      })
      .filter((item): item is LaundryQueueItem => Boolean(item));

    queueItems.sort((firstItem, secondItem) => {
      if (firstItem.urgency_score !== secondItem.urgency_score) {
        return secondItem.urgency_score - firstItem.urgency_score;
      }

      if (firstItem.days_since_last_wash !== secondItem.days_since_last_wash) {
        return secondItem.days_since_last_wash - firstItem.days_since_last_wash;
      }

      return secondItem.wear_count_since_wash - firstItem.wear_count_since_wash;
    });

    return queueItems;
  }

  private calculateMonthsSpan(startDate: Date, endDate: Date): number {
    const monthDifference =
      (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
      (endDate.getUTCMonth() - startDate.getUTCMonth());

    return Math.max(monthDifference + 1, 1);
  }

  private handleServiceError(error: unknown, endpoint: string, userId: string): never {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error("Laundry service operation failed", {
      endpoint,
      userId,
      error: error instanceof Error ? error.message : "Unknown laundry service error",
      timestamp: new Date().toISOString()
    });

    throw new AppError("Unable to process laundry request", 500, "INTERNAL_500");
  }

  public async getQueue(userId: string, includeSoon = true): Promise<LaundryQueueItem[]> {
    try {
      await this.ensureActiveUser(userId);

      const queueItems = await this.buildLaundryQueue(userId, includeSoon);

      logger.info("Laundry queue fetched", {
        endpoint: "laundry/queue",
        userId,
        includeSoon,
        total: queueItems.length,
        timestamp: new Date().toISOString()
      });

      return queueItems;
    } catch (error) {
      this.handleServiceError(error, "laundry/queue", userId);
    }
  }

  public async markWashed(userId: string, input: MarkWashedInput): Promise<LaundryUpdatedCloth> {
    try {
      await this.ensureActiveUser(userId);

      const washDate = new Date();

      const updatedCloth = await prisma.$transaction(async (transactionClient) => {
        const cloth = await this.getOwnedClothOrThrow(userId, input.cloth_id, transactionClient);

        await transactionClient.washRecord.create({
          data: {
            cloth_id: cloth.id,
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
            id: cloth.id
          },
          data: {
            wash_count: {
              increment: 1
            },
            last_washed_at: washDate,
            quality_score: recalculatedQualityScore
          },
          select: updatedClothSelect
        });

        await transactionClient.qualityHistory.create({
          data: {
            cloth_id: cloth.id,
            user_id: userId,
            quality_score: recalculatedQualityScore,
            wear_count_at_record: updated.wear_count,
            wash_count_at_record: updated.wash_count,
            notes: `Laundry wash recorded: ${input.wash_type}`,
            recorded_at: washDate
          }
        });

        return updated;
      });

      logger.info("Laundry mark-washed completed", {
        endpoint: "laundry/mark-washed",
        userId,
        clothId: input.cloth_id,
        washType: input.wash_type,
        timestamp: new Date().toISOString()
      });

      return this.toUpdatedCloth(updatedCloth);
    } catch (error) {
      this.handleServiceError(error, "laundry/mark-washed", userId);
    }
  }

  public async getHistory(
    userId: string,
    page: number,
    limit: number,
    filters: LaundryHistoryFilters
  ): Promise<{ items: LaundryHistoryItem[]; total: number }> {
    try {
      await this.ensureActiveUser(userId);

      if (filters.cloth_id) {
        await this.getOwnedClothOrThrow(userId, filters.cloth_id);
      }

      const where: Prisma.WashRecordWhereInput = {
        user_id: userId,
        is_deleted: false
      };

      if (filters.cloth_id) {
        where.cloth_id = filters.cloth_id;
      }

      if (filters.from_date || filters.to_date) {
        const washDateFilter: Prisma.DateTimeFilter = {};

        if (filters.from_date) {
          washDateFilter.gte = filters.from_date;
        }

        if (filters.to_date) {
          washDateFilter.lte = filters.to_date;
        }

        where.wash_date = washDateFilter;
      }

      const skip = (page - 1) * limit;

      const [washRecords, total] = await Promise.all([
        prisma.washRecord.findMany({
          where,
          orderBy: {
            wash_date: "desc"
          },
          skip,
          take: limit,
          select: washHistorySelect
        }),
        prisma.washRecord.count({
          where
        })
      ]);

      logger.info("Laundry history fetched", {
        endpoint: "laundry/history",
        userId,
        page,
        limit,
        total,
        timestamp: new Date().toISOString()
      });

      return {
        items: washRecords.map((washRecord) => this.toHistoryItem(washRecord)),
        total
      };
    } catch (error) {
      this.handleServiceError(error, "laundry/history", userId);
    }
  }

  public async getStats(userId: string, includeSoon = true): Promise<LaundryStats> {
    try {
      await this.ensureActiveUser(userId);

      const now = new Date();
      const currentWeekStart = new Date(now);
      currentWeekStart.setUTCDate(now.getUTCDate() - 6);
      currentWeekStart.setUTCHours(0, 0, 0, 0);

      const lastWeekStart = new Date(currentWeekStart);
      lastWeekStart.setUTCDate(currentWeekStart.getUTCDate() - 7);

      const [currentWeekWashCount, lastWeekWashCount, washAggregate, queueItems] = await Promise.all([
        prisma.washRecord.count({
          where: {
            user_id: userId,
            is_deleted: false,
            wash_date: {
              gte: currentWeekStart,
              lte: now
            }
          }
        }),
        prisma.washRecord.count({
          where: {
            user_id: userId,
            is_deleted: false,
            wash_date: {
              gte: lastWeekStart,
              lt: currentWeekStart
            }
          }
        }),
        prisma.washRecord.aggregate({
          where: {
            user_id: userId,
            is_deleted: false
          },
          _count: {
            _all: true
          },
          _min: {
            wash_date: true
          }
        }),
        this.buildLaundryQueue(userId, includeSoon)
      ]);

      const totalOverdue = queueItems.filter((queueItem) => queueItem.status === "overdue").length;
      const totalInQueue = queueItems.length;

      const totalWashCount = washAggregate._count._all;
      const firstWashDate = washAggregate._min.wash_date;
      const monthsSpan = firstWashDate ? this.calculateMonthsSpan(firstWashDate, now) : 1;
      const averageWashesPerMonth = Number((totalWashCount / monthsSpan).toFixed(2));

      const weekDifference = currentWeekWashCount - lastWeekWashCount;
      const trend: "up" | "down" | "same" =
        weekDifference > 0 ? "up" : weekDifference < 0 ? "down" : "same";
      const percentageChange =
        lastWeekWashCount === 0
          ? currentWeekWashCount === 0
            ? 0
            : 100
          : Number(((weekDifference / lastWeekWashCount) * 100).toFixed(2));

      logger.info("Laundry stats fetched", {
        endpoint: "laundry/stats",
        userId,
        totalWashCount,
        totalInQueue,
        totalOverdue,
        timestamp: new Date().toISOString()
      });

      return {
        total_washed_this_week: currentWeekWashCount,
        total_overdue: totalOverdue,
        total_in_queue: totalInQueue,
        average_washes_per_month: averageWashesPerMonth,
        compare_to_last_week: {
          current_week_washes: currentWeekWashCount,
          last_week_washes: lastWeekWashCount,
          difference: weekDifference,
          trend,
          percentage_change: percentageChange
        }
      };
    } catch (error) {
      this.handleServiceError(error, "laundry/stats", userId);
    }
  }

  public async getFabricTips(userId: string, fabricType: string): Promise<LaundryFabricTipsResponse> {
    try {
      await this.ensureActiveUser(userId);

      const normalizedFabricKey = this.normalizeFabricTipKey(fabricType);
      const fallbackTips = LAUNDRY_FABRIC_CARE_TIPS[LAUNDRY_DEFAULT_FABRIC_KEY];

      if (!fallbackTips) {
        throw new AppError("Laundry tips configuration missing", 500, "INTERNAL_500");
      }

      const tips =
        LAUNDRY_FABRIC_CARE_TIPS[normalizedFabricKey] ?? fallbackTips;

      logger.info("Laundry fabric tips fetched", {
        endpoint: "laundry/tips",
        userId,
        requestedFabric: fabricType,
        matchedFabric: tips.fabric_type,
        timestamp: new Date().toISOString()
      });

      return {
        ...tips,
        requested_fabric: fabricType,
        matched_fabric: tips.fabric_type
      };
    } catch (error) {
      this.handleServiceError(error, "laundry/tips", userId);
    }
  }

  public async list(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ items: LaundryRecord[]; total: number }> {
    try {
      const history = await this.getHistory(userId, page, limit, {});

      return {
        items: history.items.map((historyItem) => {
          return {
            id: historyItem.id,
            userId,
            name: historyItem.cloth_name,
            description: `${historyItem.wash_type} on ${historyItem.wash_date}`,
            createdAt: historyItem.created_at,
            updatedAt: historyItem.created_at
          };
        }),
        total: history.total
      };
    } catch (error) {
      this.handleServiceError(error, "laundry/legacy-list", userId);
    }
  }

  public async create(
    userId: string,
    input: { name: string; description?: string }
  ): Promise<LaundryRecord> {
    const now = new Date().toISOString();

    return {
      id: uuidv4(),
      userId,
      name: input.name,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now
    };
  }
}

const laundryService = new LaundryService();

export default laundryService;
