import { z } from "zod";

const nonEmptyTextSchema = z.string().trim().min(1);

const normalizeUpperUnderscore = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
};

const washTypeSchema = z.preprocess(
  normalizeUpperUnderscore,
  z.enum(["MACHINE_WASH", "HAND_WASH", "DRY_CLEAN"])
);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const laundryQueueQuerySchema = z.object({
  include_soon: z.coerce.boolean().optional().default(true)
});

export const markWashedSchema = z.object({
  cloth_id: z.string().uuid(),
  wash_type: washTypeSchema,
  water_temperature: nonEmptyTextSchema.max(30).optional(),
  notes: nonEmptyTextSchema.max(500).optional()
});

export const laundryHistoryQuerySchema = paginationQuerySchema
  .extend({
    cloth_id: z.string().uuid().optional(),
    from_date: z.coerce.date().optional(),
    to_date: z.coerce.date().optional()
  })
  .refine(
    (value) => {
      if (!value.from_date || !value.to_date) {
        return true;
      }

      return value.from_date <= value.to_date;
    },
    {
      message: "from_date must be less than or equal to to_date"
    }
  );

export const laundryTipsParamsSchema = z.object({
  fabricType: nonEmptyTextSchema.max(50)
});

export const laundryStatsQuerySchema = z.object({
  include_soon: z.coerce.boolean().optional().default(true)
});

// Backward-compatible legacy schemas
export const createLaundrySchema = z.object({
  name: nonEmptyTextSchema.max(120),
  description: nonEmptyTextSchema.max(300).optional()
});

export const updateLaundrySchema = createLaundrySchema.partial();

export const laundryIdParamsSchema = z.object({
  id: z.string().uuid()
});
