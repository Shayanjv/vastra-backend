import { z } from "zod";

const nonEmptyTextSchema = z.string().trim().min(1);

const hasAtLeastOneDefinedField = (value: Record<string, unknown>): boolean => {
  return Object.values(value).some((fieldValue) => fieldValue !== undefined);
};

const weatherObjectSchema = z
  .object({
    summary: nonEmptyTextSchema.max(300).optional(),
    condition: nonEmptyTextSchema.max(120).optional(),
    temperature_c: z.coerce.number().min(-20).max(60).optional(),
    humidity: z.coerce.number().min(0).max(100).optional(),
    rain_probability: z.coerce.number().min(0).max(100).optional()
  })
  .passthrough()
  .refine(hasAtLeastOneDefinedField, {
    message: "weather object must include at least one field"
  });

export const outfitPaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const paginationQuerySchema = outfitPaginationQuerySchema;

export const suggestOutfitSchema = z.object({
  occasion: nonEmptyTextSchema.max(120),
  weather: z.union([nonEmptyTextSchema.max(300), weatherObjectSchema]),
  date: z.coerce.date()
});

export const outfitHistoryQuerySchema = outfitPaginationQuerySchema
  .extend({
    occasion: nonEmptyTextSchema.max(120).optional(),
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

export const outfitIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const outfitWearSchema = z.object({
  worn_at: z.coerce.date().optional()
});

export const saveOutfitSchema = z.object({
  name: nonEmptyTextSchema.max(120),
  clothes_ids: z.array(z.string().uuid()).min(2).max(8),
  occasion_tag: nonEmptyTextSchema.max(120).optional()
});

export const savedOutfitQuerySchema = outfitPaginationQuerySchema;

export const savedOutfitIdParamsSchema = z.object({
  id: z.string().uuid()
});

// Backward-compatible legacy exports
export const createOutfitSchema = z.object({
  name: nonEmptyTextSchema.max(120),
  description: nonEmptyTextSchema.max(300).optional()
});

export const updateOutfitSchema = createOutfitSchema.partial();
