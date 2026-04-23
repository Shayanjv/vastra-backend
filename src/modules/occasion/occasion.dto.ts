import { z } from "zod";

const nonEmptyTextSchema = z.string().trim().min(1);

export const occasionPaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const paginationQuerySchema = occasionPaginationQuerySchema;

export const occasionListQuerySchema = z.object({
  search: nonEmptyTextSchema.max(120).optional()
});

export const createOccasionSchema = z.object({
  occasion_type: nonEmptyTextSchema.max(120),
  outfit_suggestion_id: z.string().uuid().optional(),
  outfit_date: z.coerce.date(),
  notes: nonEmptyTextSchema.max(500).optional()
});

export const occasionHistoryQuerySchema = occasionPaginationQuerySchema
  .extend({
    occasion_type: nonEmptyTextSchema.max(120).optional(),
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

export const updateOccasionSchema = z
  .object({
    occasion_type: nonEmptyTextSchema.max(120).optional(),
    outfit_suggestion_id: z.string().uuid().optional(),
    outfit_date: z.coerce.date().optional(),
    notes: nonEmptyTextSchema.max(500).optional()
  })
  .refine(
    (value) => {
      return Object.values(value).some((fieldValue) => fieldValue !== undefined);
    },
    {
      message: "At least one occasion field must be provided"
    }
  );

export const occasionIdParamsSchema = z.object({
  id: z.string().uuid()
});
