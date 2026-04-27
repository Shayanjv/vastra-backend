import { z } from "zod";

const nonEmptyTextSchema = z.string().trim().min(1);

const stylePreferenceItemSchema = nonEmptyTextSchema.max(50);

const stylePreferencesSchema = z.array(stylePreferenceItemSchema).max(30);

const time24HourSchema = /^([01]\d|2[0-3]):[0-5]\d$/;

const hasAtLeastOneDefinedField = (value: Record<string, unknown>): boolean => {
  return Object.values(value).some((fieldValue) => fieldValue !== undefined);
};

const profileInputSchema = z.object({
  name: nonEmptyTextSchema.max(100).optional(),
  fullName: nonEmptyTextSchema.max(100).optional(),
  displayName: nonEmptyTextSchema.max(100).optional(),
  city: nonEmptyTextSchema.max(120).optional(),
  state: nonEmptyTextSchema.max(120).optional(),
  profile_photo_url: z.string().trim().url().max(2048).optional(),
  profilePhotoUrl: z.string().trim().url().max(2048).optional(),
  skin_tone: nonEmptyTextSchema.max(60).optional(),
  skinTone: nonEmptyTextSchema.max(60).optional(),
  body_type: nonEmptyTextSchema.max(60).optional(),
  bodyType: nonEmptyTextSchema.max(60).optional(),
  style_preferences: stylePreferencesSchema.optional(),
  stylePreferences: stylePreferencesSchema.optional(),
  preferences: z
    .object({
      style: z.union([stylePreferenceItemSchema, stylePreferencesSchema]).optional(),
      skinTone: nonEmptyTextSchema.max(60).optional()
    })
    .passthrough()
    .optional()
});

type ProfileInput = z.infer<typeof profileInputSchema>;

type NormalizedProfileInput = {
  name?: string;
  city?: string;
  state?: string;
  profile_photo_url?: string;
  skin_tone?: string;
  body_type?: string;
  style_preferences?: string[];
};

const normalizeStylePreferences = (
  directStyles: ProfileInput["style_preferences"] | ProfileInput["stylePreferences"],
  preferenceStyle: string | string[] | undefined
): string[] | undefined => {
  if (directStyles && directStyles.length > 0) {
    return directStyles;
  }

  if (typeof preferenceStyle === "string") {
    return [preferenceStyle];
  }

  if (Array.isArray(preferenceStyle) && preferenceStyle.length > 0) {
    return preferenceStyle;
  }

  return undefined;
};

const normalizeProfileInput = (value: ProfileInput): NormalizedProfileInput => {
  const stylePreferences = normalizeStylePreferences(
    value.style_preferences ?? value.stylePreferences,
    value.preferences?.style
  );

  return {
    name: value.name ?? value.fullName ?? value.displayName,
    city: value.city,
    state: value.state,
    profile_photo_url: value.profile_photo_url ?? value.profilePhotoUrl,
    skin_tone: value.skin_tone ?? value.skinTone ?? value.preferences?.skinTone,
    body_type: value.body_type ?? value.bodyType,
    style_preferences: stylePreferences
  };
};

const hasAtLeastOneProfileField = (value: NormalizedProfileInput): boolean => {
  return hasAtLeastOneDefinedField({
    name: value.name,
    city: value.city,
    state: value.state,
    profile_photo_url: value.profile_photo_url,
    skin_tone: value.skin_tone,
    body_type: value.body_type,
    style_preferences: value.style_preferences
  });
};

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const createUserSchema = profileInputSchema
  .extend({
    description: z.string().trim().min(1).max(500).optional()
  })
  .transform((value) => {
    return {
      ...normalizeProfileInput(value),
      description: value.description
    };
  })
  .refine(
    (value) => {
      return hasAtLeastOneProfileField(value);
    },
    {
      message: "At least one profile field must be provided"
    }
  );

export const updateUserSchema = createUserSchema;

export const userIdParamsSchema = z.object({
  id: z.string().uuid()
});

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

export const updateUserProfileSchema = profileInputSchema
  .transform((value) => {
    return normalizeProfileInput(value);
  })
  .refine(hasAtLeastOneProfileField, {
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
