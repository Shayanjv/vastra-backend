import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const createUserSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional()
});

export const updateUserSchema = createUserSchema.partial();

export const userIdParamsSchema = z.object({
  id: z.string().uuid()
});

const nonEmptyTextSchema = z.string().trim().min(1);

const time24HourSchema = /^([01]\d|2[0-3]):[0-5]\d$/;

const hasAtLeastOneDefinedField = (value: Record<string, unknown>): boolean => {
  return Object.values(value).some((fieldValue) => fieldValue !== undefined);
};

const hasNotificationToggleValue = (
  toggles:
    | {
        laundry_reminder?: boolean;
        quality_alerts?: boolean;
        weekly_report?: boolean;
      }
    | undefined
): boolean => {
  if (!toggles) {
    return false;
  }

  return (
    typeof toggles.laundry_reminder === "boolean" ||
    typeof toggles.quality_alerts === "boolean" ||
    typeof toggles.weekly_report === "boolean"
  );
};

export const updateUserProfileSchema = z
  .object({
    name: nonEmptyTextSchema.max(100).optional(),
    city: nonEmptyTextSchema.max(120).optional(),
    state: nonEmptyTextSchema.max(120).optional(),
    profile_photo_url: z.string().trim().url().max(2048).optional(),
    skin_tone: nonEmptyTextSchema.max(60).optional(),
    body_type: nonEmptyTextSchema.max(60).optional(),
    style_preferences: z.array(nonEmptyTextSchema.max(50)).max(30).optional()
  })
  .refine(hasAtLeastOneDefinedField, {
    message: "At least one profile field must be provided"
  });

export const notificationTogglesSchema = z
  .object({
    laundry_reminder: z.boolean().optional(),
    quality_alerts: z.boolean().optional(),
    weekly_report: z.boolean().optional()
  })
  .strict();

export const updateUserPreferencesSchema = z
  .object({
    morning_outfit_time: z
      .string()
      .trim()
      .regex(time24HourSchema, "morning_outfit_time must follow HH:mm format")
      .optional(),
    notification_toggles: notificationTogglesSchema.optional(),
    language: z.string().trim().min(2).max(10).optional()
  })
  .refine(
    (value) => {
      return (
        value.morning_outfit_time !== undefined ||
        value.language !== undefined ||
        hasNotificationToggleValue(value.notification_toggles)
      );
    },
    {
      message: "At least one preference field must be provided"
    }
  );

export const updateFcmTokenSchema = z.object({
  fcm_token: z.string().trim().min(20).max(4096)
});
