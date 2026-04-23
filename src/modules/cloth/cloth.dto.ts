import { z } from "zod";

const nonEmptyTextSchema = z.string().trim().min(1);

const hasAtLeastOneDefinedField = (value: Record<string, unknown>): boolean => {
  return Object.values(value).some((fieldValue) => fieldValue !== undefined);
};

const normalizeUpperUnderscore = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
};

const fabricTypeSchema = z.preprocess(
  normalizeUpperUnderscore,
  z.enum(["POLYESTER", "DENIM", "COTTON", "LINEN", "WOOL", "RAYON", "SILK", "KHADI", "OTHER"])
);

const washTypeSchema = z.preprocess(
  normalizeUpperUnderscore,
  z.enum(["MACHINE_WASH", "HAND_WASH", "DRY_CLEAN"])
);

export const clothListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z.string().trim().min(1).max(80).optional(),
  occasion: z.string().trim().min(1).max(50).optional(),
  season: z.string().trim().min(1).max(50).optional(),
  search: z.string().trim().min(1).max(120).optional()
});

export const paginationQuerySchema = clothListQuerySchema;

export const createClothSchema = z.object({
  name: nonEmptyTextSchema.max(120),
  category: nonEmptyTextSchema.max(80),
  fabric_type: fabricTypeSchema,
  color_primary: nonEmptyTextSchema.max(60),
  color_secondary: nonEmptyTextSchema.max(60).optional(),
  pattern: nonEmptyTextSchema.max(80).optional(),
  brand: nonEmptyTextSchema.max(100).optional(),
  purchase_price: z.coerce.number().nonnegative().max(1_000_000).optional(),
  purchase_date: z.coerce.date().optional(),
  occasions: z.array(nonEmptyTextSchema.max(50)).max(30).optional().default([]),
  season: z.array(nonEmptyTextSchema.max(50)).max(10).optional().default([]),
  size: nonEmptyTextSchema.max(30).optional(),
  care_instructions: nonEmptyTextSchema.max(500).optional(),
  photo_urls: z.array(z.string().trim().url().max(2048)).max(10).optional().default([])
});

export const updateClothSchema = z
  .object({
    name: nonEmptyTextSchema.max(120).optional(),
    category: nonEmptyTextSchema.max(80).optional(),
    fabric_type: fabricTypeSchema.optional(),
    color_primary: nonEmptyTextSchema.max(60).optional(),
    color_secondary: nonEmptyTextSchema.max(60).optional(),
    pattern: nonEmptyTextSchema.max(80).optional(),
    brand: nonEmptyTextSchema.max(100).optional(),
    purchase_price: z.coerce.number().nonnegative().max(1_000_000).optional(),
    purchase_date: z.coerce.date().optional(),
    occasions: z.array(nonEmptyTextSchema.max(50)).max(30).optional(),
    season: z.array(nonEmptyTextSchema.max(50)).max(10).optional(),
    size: nonEmptyTextSchema.max(30).optional(),
    care_instructions: nonEmptyTextSchema.max(500).optional(),
    photo_urls: z.array(z.string().trim().url().max(2048)).max(10).optional()
  })
  .refine(hasAtLeastOneDefinedField, {
    message: "At least one cloth field must be provided"
  });

export const clothIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const clothWearSchema = z.object({
  worn_at: z.coerce.date().optional()
});

export const clothWashSchema = z.object({
  wash_type: washTypeSchema,
  wash_date: z.coerce.date().optional(),
  water_temperature: nonEmptyTextSchema.max(30).optional(),
  notes: nonEmptyTextSchema.max(500).optional()
});
