export type FabricTypeKey =
  | "POLYESTER"
  | "DENIM"
  | "COTTON"
  | "LINEN"
  | "WOOL"
  | "RAYON"
  | "SILK"
  | "KHADI"
  | "OTHER";

interface QualityInput {
  fabric: FabricTypeKey;
  wearCount: number;
  machineWashCount: number;
  handWashCount: number;
  dryCleanCount: number;
  ageMonths: number;
}

interface QualityProjectionInput {
  current: QualityInput;
  averageWearPerMonth: number;
  averageMachineWashPerMonth: number;
  averageHandWashPerMonth: number;
  averageDryCleanPerMonth: number;
}

interface OutfitFilterCloth {
  id: string;
  fabric_type: string;
  wear_count: number;
  wash_count: number;
  is_deleted?: boolean;
  last_worn_at?: Date | string | null;
}

interface OutfitWeather {
  temp: number;
}

const BASE_SCORE = 100;

const FABRIC_DURABILITY: Record<FabricTypeKey, number> = {
  POLYESTER: 0.99,
  DENIM: 0.98,
  COTTON: 0.95,
  LINEN: 0.9,
  WOOL: 0.87,
  RAYON: 0.85,
  SILK: 0.75,
  KHADI: 0.88,
  OTHER: 0.85
};

const WEAR_DEGRADATION = 0.8;
const MACHINE_WASH_DEGRADATION = 1.5;
const HAND_WASH_DEGRADATION = 0.8;
const DRY_CLEAN_DEGRADATION = 0.3;
const MONTHLY_AGE_DEGRADATION = 0.5;

export const WEAR_LIMITS: Record<string, number> = {
  Denim: 4,
  Cotton: 1,
  Linen: 2,
  Wool: 3,
  Silk: 1,
  Polyester: 3,
  Rayon: 2,
  Khadi: 2,
  Synthetic: 2
};

const clampScore = (score: number): number => {
  return Math.max(0, Math.min(100, score));
};

export const calculateQualityScore = (input: QualityInput): number => {
  const durabilityAdjustedBase = BASE_SCORE * FABRIC_DURABILITY[input.fabric];

  const degradation =
    input.wearCount * WEAR_DEGRADATION +
    input.machineWashCount * MACHINE_WASH_DEGRADATION +
    input.handWashCount * HAND_WASH_DEGRADATION +
    input.dryCleanCount * DRY_CLEAN_DEGRADATION +
    input.ageMonths * MONTHLY_AGE_DEGRADATION;

  const computedScore = durabilityAdjustedBase - degradation;

  return Number(clampScore(computedScore).toFixed(2));
};

export const projectThreeMonthQuality = (input: QualityProjectionInput): number => {
  const projectedInput: QualityInput = {
    ...input.current,
    wearCount: input.current.wearCount + input.averageWearPerMonth * 3,
    machineWashCount: input.current.machineWashCount + input.averageMachineWashPerMonth * 3,
    handWashCount: input.current.handWashCount + input.averageHandWashPerMonth * 3,
    dryCleanCount: input.current.dryCleanCount + input.averageDryCleanPerMonth * 3,
    ageMonths: input.current.ageMonths + 3
  };

  return calculateQualityScore(projectedInput);
};

const toWearLimitKey = (fabricType: string): string => {
  const normalized = fabricType.trim().toLowerCase();

  if (normalized.includes("denim")) return "Denim";
  if (normalized.includes("cotton")) return "Cotton";
  if (normalized.includes("linen")) return "Linen";
  if (normalized.includes("wool")) return "Wool";
  if (normalized.includes("silk")) return "Silk";
  if (normalized.includes("polyester")) return "Polyester";
  if (normalized.includes("rayon")) return "Rayon";
  if (normalized.includes("khadi")) return "Khadi";

  return "Synthetic";
};

const toDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const calculateFreshnessScore = (cloth: OutfitFilterCloth): number => {
  const maxWears = WEAR_LIMITS[toWearLimitKey(cloth.fabric_type)] ?? 2;
  const wearCount = Math.max(0, cloth.wear_count - cloth.wash_count);

  const lastWornDate = toDate(cloth.last_worn_at);
  const now = Date.now();
  const daysSinceLastWorn = lastWornDate
    ? Math.max(0, (now - lastWornDate.getTime()) / (1000 * 60 * 60 * 24))
    : 30;

  const freshness = (maxWears - wearCount) * 0.6 + daysSinceLastWorn * 0.4;
  return Number(freshness.toFixed(2));
};

const isWeatherInappropriate = (fabricType: string, temp: number): boolean => {
  const normalized = fabricType.toLowerCase();
  const heavy = normalized.includes("wool") || normalized.includes("heavy");

  if (heavy && temp > 28) {
    return true;
  }

  return false;
};

export function filterClothesForOutfit<T extends OutfitFilterCloth>(
  clothes: T[],
  weather: OutfitWeather
): T[] {
  const prepared = clothes
    .filter((cloth) => !cloth.is_deleted)
    .filter((cloth) => {
      const wearLimit = WEAR_LIMITS[toWearLimitKey(cloth.fabric_type)] ?? 2;
      const wearCount = Math.max(0, cloth.wear_count - cloth.wash_count);
      return wearCount < wearLimit;
    })
    .filter((cloth) => !isWeatherInappropriate(cloth.fabric_type, weather.temp))
    .map((cloth) => ({
      cloth,
      freshnessScore: calculateFreshnessScore(cloth)
    }))
    .sort((a, b) => b.freshnessScore - a.freshnessScore)
    .slice(0, 20)
    .map((entry) => entry.cloth);

  return prepared;
}

export const calculateCPW = (purchasePrice: number, wearCount: number): number => {
  if (wearCount === 0) {
    return purchasePrice;
  }

  return Number((purchasePrice / wearCount).toFixed(2));
};
