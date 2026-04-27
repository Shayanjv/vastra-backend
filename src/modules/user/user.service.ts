import prisma from "../../config/database";
import { AppError } from "../../utils/error.util";
import logger from "../../utils/logger.util";

export interface UserRecord {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PersistedUserProfile {
  id: string;
  firebase_uid: string;
  email: string | null;
  phone: string | null;
  name: string;
  city: string | null;
  state: string | null;
  profile_photo_url: string | null;
  skin_tone: string | null;
  body_type: string | null;
  style_preferences: string[];
  is_premium: boolean;
  premium_expires_at: Date | null;
  is_active: boolean;
  is_deleted: boolean;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface PersistedUserPreference {
  user_id: string;
  morning_outfit_time: string;
  laundry_reminder: boolean;
  quality_alerts: boolean;
  weekly_report: boolean;
  language: string;
  is_deleted: boolean;
  updated_at: Date;
}

export interface UserProfile {
  id: string;
  firebase_uid: string;
  email: string | null;
  phone: string | null;
  name: string;
  city: string | null;
  state: string | null;
  profile_photo_url: string | null;
  skin_tone: string | null;
  body_type: string | null;
  style_preferences: string[];
  is_premium: boolean;
  premium_expires_at: string | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  morning_outfit_time: string;
  notification_toggles: {
    laundry_reminder: boolean;
    quality_alerts: boolean;
    weekly_report: boolean;
  };
  language: string;
  updated_at: string;
}

export interface UpdateUserProfileInput {
  name?: string;
  city?: string;
  state?: string;
  profile_photo_url?: string;
  skin_tone?: string;
  body_type?: string;
  style_preferences?: string[];
}

export interface UpdateUserPreferencesInput {
  morning_outfit_time?: string;
  notification_toggles?: {
    laundry_reminder?: boolean;
    quality_alerts?: boolean;
    weekly_report?: boolean;
  };
  language?: string;
}

class UserService {
  private readonly userProfileSelect = {
    id: true,
    firebase_uid: true,
    email: true,
    phone: true,
    name: true,
    city: true,
    state: true,
    profile_photo_url: true,
    skin_tone: true,
    body_type: true,
    style_preferences: true,
    is_premium: true,
    premium_expires_at: true,
    is_active: true,
    is_deleted: true,
    last_login: true,
    created_at: true,
    updated_at: true
  } as const;

  private readonly userPreferenceSelect = {
    user_id: true,
    morning_outfit_time: true,
    laundry_reminder: true,
    quality_alerts: true,
    weekly_report: true,
    language: true,
    is_deleted: true,
    updated_at: true
  } as const;

  private toUserProfile(user: PersistedUserProfile): UserProfile {
    return {
      id: user.id,
      firebase_uid: user.firebase_uid,
      email: user.email,
      phone: user.phone,
      name: user.name,
      city: user.city,
      state: user.state,
      profile_photo_url: user.profile_photo_url,
      skin_tone: user.skin_tone,
      body_type: user.body_type,
      style_preferences: user.style_preferences,
      is_premium: user.is_premium,
      premium_expires_at: user.premium_expires_at ? user.premium_expires_at.toISOString() : null,
      last_login: user.last_login ? user.last_login.toISOString() : null,
      created_at: user.created_at.toISOString(),
      updated_at: user.updated_at.toISOString()
    };
  }

  private toUserPreferences(preferences: PersistedUserPreference): UserPreferences {
    return {
      morning_outfit_time: preferences.morning_outfit_time,
      notification_toggles: {
        laundry_reminder: preferences.laundry_reminder,
        quality_alerts: preferences.quality_alerts,
        weekly_report: preferences.weekly_report
      },
      language: preferences.language,
      updated_at: preferences.updated_at.toISOString()
    };
  }

  private toLegacyUserRecord(user: UserProfile, description: string | null): UserRecord {
    return {
      id: user.id,
      userId: user.id,
      name: user.name,
      description,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  }

  private normalizePreferences(stylePreferences: string[]): string[] {
    return Array.from(
      new Set(stylePreferences.map((preference) => preference.trim()).filter((value) => value.length > 0))
    );
  }

  private async getActiveUserOrThrow(userId: string): Promise<PersistedUserProfile> {
    const user = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: this.userProfileSelect
    });

    if (!user || user.is_deleted) {
      throw new AppError("User not found", 404, "USER_001");
    }

    if (!user.is_active) {
      throw new AppError("Unauthorized", 401, "AUTH_003");
    }

    return user;
  }

  private handleServiceError(error: unknown, endpoint: string, userId: string): never {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error("User service operation failed", {
      endpoint,
      userId,
      error: error instanceof Error ? error.message : "Unknown user service error",
      timestamp: new Date().toISOString()
    });

    throw new AppError("Unable to process user request", 500, "INTERNAL_500");
  }

  private async ensureUserPreferences(userId: string): Promise<PersistedUserPreference> {
    const userPreferences = await prisma.userPreference.upsert({
      where: {
        user_id: userId
      },
      update: {
        is_deleted: false
      },
      create: {
        user_id: userId
      },
      select: this.userPreferenceSelect
    });

    return userPreferences;
  }

  public async getProfile(userId: string): Promise<UserProfile> {
    try {
      const user = await this.getActiveUserOrThrow(userId);

      logger.info("User profile fetched", {
        endpoint: "user/get-profile",
        userId,
        timestamp: new Date().toISOString()
      });

      return this.toUserProfile(user);
    } catch (error) {
      this.handleServiceError(error, "user/get-profile", userId);
    }
  }

  public async updateProfile(userId: string, input: UpdateUserProfileInput): Promise<UserProfile> {
    try {
      await this.getActiveUserOrThrow(userId);

      const updateData: {
        name?: string;
        city?: string;
        state?: string;
        profile_photo_url?: string;
        skin_tone?: string;
        body_type?: string;
        style_preferences?: string[];
      } = {};

      if (input.name !== undefined) {
        updateData.name = input.name;
      }

      if (input.city !== undefined) {
        updateData.city = input.city;
      }

      if (input.state !== undefined) {
        updateData.state = input.state;
      }

      if (input.profile_photo_url !== undefined) {
        updateData.profile_photo_url = input.profile_photo_url;
      }

      if (input.skin_tone !== undefined) {
        updateData.skin_tone = input.skin_tone;
      }

      if (input.body_type !== undefined) {
        updateData.body_type = input.body_type;
      }

      if (input.style_preferences !== undefined) {
        updateData.style_preferences = this.normalizePreferences(input.style_preferences);
      }

      const updatedUser = await prisma.user.update({
        where: {
          id: userId
        },
        data: updateData,
        select: this.userProfileSelect
      });

      logger.info("User profile updated", {
        endpoint: "user/update-profile",
        userId,
        updatedFields: Object.keys(updateData),
        timestamp: new Date().toISOString()
      });

      return this.toUserProfile(updatedUser);
    } catch (error) {
      this.handleServiceError(error, "user/update-profile", userId);
    }
  }

  public async getPreferences(userId: string): Promise<UserPreferences> {
    try {
      await this.getActiveUserOrThrow(userId);
      const preferences = await this.ensureUserPreferences(userId);

      logger.info("User preferences fetched", {
        endpoint: "user/get-preferences",
        userId,
        timestamp: new Date().toISOString()
      });

      return this.toUserPreferences(preferences);
    } catch (error) {
      this.handleServiceError(error, "user/get-preferences", userId);
    }
  }

  public async updatePreferences(
    userId: string,
    input: UpdateUserPreferencesInput
  ): Promise<UserPreferences> {
    try {
      await this.getActiveUserOrThrow(userId);

      const updateData: {
        is_deleted: boolean;
        morning_outfit_time?: string;
        language?: string;
        laundry_reminder?: boolean;
        quality_alerts?: boolean;
        weekly_report?: boolean;
      } = {
        is_deleted: false
      };

      const createData: {
        user_id: string;
        morning_outfit_time?: string;
        language?: string;
        laundry_reminder?: boolean;
        quality_alerts?: boolean;
        weekly_report?: boolean;
      } = {
        user_id: userId
      };

      if (input.morning_outfit_time !== undefined) {
        updateData.morning_outfit_time = input.morning_outfit_time;
        createData.morning_outfit_time = input.morning_outfit_time;
      }

      if (input.language !== undefined) {
        updateData.language = input.language;
        createData.language = input.language;
      }

      if (input.notification_toggles?.laundry_reminder !== undefined) {
        updateData.laundry_reminder = input.notification_toggles.laundry_reminder;
        createData.laundry_reminder = input.notification_toggles.laundry_reminder;
      }

      if (input.notification_toggles?.quality_alerts !== undefined) {
        updateData.quality_alerts = input.notification_toggles.quality_alerts;
        createData.quality_alerts = input.notification_toggles.quality_alerts;
      }

      if (input.notification_toggles?.weekly_report !== undefined) {
        updateData.weekly_report = input.notification_toggles.weekly_report;
        createData.weekly_report = input.notification_toggles.weekly_report;
      }

      const updatedPreferences = await prisma.userPreference.upsert({
        where: {
          user_id: userId
        },
        update: updateData,
        create: createData,
        select: this.userPreferenceSelect
      });

      logger.info("User preferences updated", {
        endpoint: "user/update-preferences",
        userId,
        updatedFields: Object.keys(updateData).filter((field) => field !== "is_deleted"),
        timestamp: new Date().toISOString()
      });

      return this.toUserPreferences(updatedPreferences);
    } catch (error) {
      this.handleServiceError(error, "user/update-preferences", userId);
    }
  }

  public async softDeleteAccount(userId: string): Promise<{ account_deleted: boolean }> {
    try {
      await this.getActiveUserOrThrow(userId);

      await prisma.$transaction(async (transactionClient) => {
        await transactionClient.user.update({
          where: {
            id: userId
          },
          data: {
            is_deleted: true,
            is_active: false,
            fcm_token: null
          }
        });

        await transactionClient.userPreference.updateMany({
          where: {
            user_id: userId
          },
          data: {
            is_deleted: true
          }
        });
      });

      logger.warn("User account soft deleted", {
        endpoint: "user/delete-account",
        userId,
        timestamp: new Date().toISOString()
      });

      return {
        account_deleted: true
      };
    } catch (error) {
      this.handleServiceError(error, "user/delete-account", userId);
    }
  }

  public async saveFcmToken(userId: string, fcmToken: string): Promise<{ fcm_token_saved: boolean }> {
    try {
      await this.getActiveUserOrThrow(userId);

      await prisma.user.update({
        where: {
          id: userId
        },
        data: {
          fcm_token: fcmToken
        },
        select: {
          id: true
        }
      });

      logger.info("User FCM token updated", {
        endpoint: "user/save-fcm-token",
        userId,
        timestamp: new Date().toISOString()
      });

      return {
        fcm_token_saved: true
      };
    } catch (error) {
      this.handleServiceError(error, "user/save-fcm-token", userId);
    }
  }

  public async list(
    userId: string,
    page: number,
    _limit: number
  ): Promise<{ items: UserRecord[]; total: number }> {
    try {
      const userProfile = await this.getProfile(userId);
      const listRecord = this.toLegacyUserRecord(userProfile, null);

      if (page > 1) {
        return {
          items: [],
          total: 1
        };
      }

      return {
        items: [listRecord],
        total: 1
      };
    } catch (error) {
      this.handleServiceError(error, "user/list", userId);
    }
  }

  public async create(
    userId: string,
    input: {
      name?: string;
      description?: string;
      city?: string;
      state?: string;
      profile_photo_url?: string;
      skin_tone?: string;
      body_type?: string;
      style_preferences?: string[];
    }
  ): Promise<UserRecord> {
    try {
      const profileUpdateInput: UpdateUserProfileInput = {
        name: input.name,
        city: input.city,
        state: input.state,
        profile_photo_url: input.profile_photo_url,
        skin_tone: input.skin_tone,
        body_type: input.body_type,
        style_preferences: input.style_preferences
      };

      const hasProfileUpdate = Object.values(profileUpdateInput).some((fieldValue) => fieldValue !== undefined);

      const updatedUser = hasProfileUpdate
        ? await this.updateProfile(userId, profileUpdateInput)
        : await this.getProfile(userId);

      return this.toLegacyUserRecord(updatedUser, input.description ?? null);
    } catch (error) {
      this.handleServiceError(error, "user/create", userId);
    }
  }
}

const userService = new UserService();

export default userService;
