import prisma from "../../config/database";
import environment from "../../config/environment";
import firebaseAdmin from "../../config/firebase";
import { AppError } from "../../utils/error.util";
import { type JwtTokenPayload, signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.util";
import logger from "../../utils/logger.util";

interface AuthUser {
  id: string;
  firebaseUid: string;
  email: string | null;
  name: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  profilePhotoUrl: string | null;
  skinTone: string | null;
  bodyType: string | null;
  stylePreferences: string[];
  isPremium: boolean;
  premiumExpiresAt: Date | null;
  lastLogin: Date | null;
  tier: "FREE" | "PREMIUM";
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  isNewUser: boolean;
}

interface RefreshResult {
  accessToken: string;
  user: AuthUser;
}

interface PersistedUser {
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
}

class AuthService {
  private readonly userAuthSelect = {
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
    last_login: true
  } as const;

  private toTier(isPremium: boolean): "FREE" | "PREMIUM" {
    return isPremium ? "PREMIUM" : "FREE";
  }

  private toAuthUser(user: PersistedUser): AuthUser {
    return {
      id: user.id,
      firebaseUid: user.firebase_uid,
      email: user.email,
      name: user.name,
      phone: user.phone,
      city: user.city,
      state: user.state,
      profilePhotoUrl: user.profile_photo_url,
      skinTone: user.skin_tone,
      bodyType: user.body_type,
      stylePreferences: user.style_preferences,
      isPremium: user.is_premium,
      premiumExpiresAt: user.premium_expires_at,
      lastLogin: user.last_login,
      tier: this.toTier(user.is_premium)
    };
  }

  private createTokenPayload(user: PersistedUser): JwtTokenPayload {
    const tokenEmail =
      typeof user.email === "string" && user.email.trim().length > 0
        ? user.email
        : "unknown@vastra.app";

    return {
      userId: user.id,
      firebaseUid: user.firebase_uid,
      email: tokenEmail,
      tier: this.toTier(user.is_premium)
    };
  }

  private getFirebaseInitStatus(): { initialized: boolean; appCount: number } {
    const appCount = firebaseAdmin.apps.length;

    return {
      initialized: appCount > 0,
      appCount
    };
  }

  private getMissingFirebaseConfigKeys(): string[] {
    const projectId = environment.FIREBASE_PROJECT_ID.trim();
    const clientEmail = environment.FIREBASE_CLIENT_EMAIL.trim();
    const privateKey = (process.env["FIREBASE_PRIVATE_KEY"] ?? environment.FIREBASE_PRIVATE_KEY)
      .replace(/\\n/g, "\n")
      .trim();

    const missing: string[] = [];

    if (!projectId) {
      missing.push("FIREBASE_PROJECT_ID");
    }

    if (!clientEmail) {
      missing.push("FIREBASE_CLIENT_EMAIL");
    }

    if (!privateKey) {
      missing.push("FIREBASE_PRIVATE_KEY");
    }

    return missing;
  }

  private async ensureUserPreferences(userId: string): Promise<void> {
    await prisma.userPreference.upsert({
      where: {
        user_id: userId
      },
      update: {
        is_deleted: false
      },
      create: {
        user_id: userId
      }
    });
  }

  public async firebaseVerify(idToken: string): Promise<LoginResult> {
    const firebaseInitStatus = this.getFirebaseInitStatus();
    const missingFirebaseConfig = this.getMissingFirebaseConfigKeys();

    logger.info("Firebase verify started", {
      endpoint: "auth/firebase-verify",
      firebaseInitialized: firebaseInitStatus.initialized,
      firebaseAppCount: firebaseInitStatus.appCount,
      missingFirebaseConfig
    });

    if (!firebaseInitStatus.initialized || missingFirebaseConfig.length > 0) {
      const missingDetails =
        missingFirebaseConfig.length > 0
          ? `Missing Firebase configuration: ${missingFirebaseConfig.join(", ")}`
          : "Firebase Admin SDK is not initialized";

      logger.error("Firebase verify blocked due to configuration.", {
        endpoint: "auth/firebase-verify",
        firebaseInitialized: firebaseInitStatus.initialized,
        firebaseAppCount: firebaseInitStatus.appCount,
        missingFirebaseConfig
      });

      throw new AppError(missingDetails, 500, "INTERNAL_500");
    }

    try {
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
      const firebaseUid = decodedToken.uid;

      if (!firebaseUid) {
        throw new AppError("Invalid Firebase token", 401, "AUTH_001");
      }

      const resolvedEmail =
        typeof decodedToken.email === "string" && decodedToken.email.trim().length > 0
          ? decodedToken.email
          : null;
      const resolvedPhone =
        typeof decodedToken["phone_number"] === "string"
          ? decodedToken["phone_number"]
          : null;

      const now = new Date();
      let isNewUser = false;

      let user = await prisma.user.findUnique({
        where: {
          firebase_uid: firebaseUid
        },
        select: this.userAuthSelect
      });

      if (!user) {
        isNewUser = true;

        const fallbackName =
          typeof decodedToken["name"] === "string" && decodedToken["name"].trim().length > 0
            ? decodedToken["name"]
            : resolvedEmail ?? firebaseUid;

        user = await prisma.$transaction(async (tx): Promise<PersistedUser> => {
          const createdUser = await tx.user.create({
            data: {
              firebase_uid: firebaseUid,
              email: resolvedEmail,
              phone: resolvedPhone,
              name: fallbackName,
              last_login: now
            },
            select: this.userAuthSelect
          });

          await tx.userPreference.create({
            data: {
              user_id: createdUser.id
            }
          });

          return createdUser;
        });
      } else {
        user = await prisma.user.update({
          where: {
            id: user.id
          },
          data: {
            last_login: now,
            email: user.email ?? resolvedEmail,
            phone: user.phone ?? resolvedPhone
          },
          select: this.userAuthSelect
        });

        await this.ensureUserPreferences(user.id);
      }

      if (user.is_deleted || !user.is_active) {
        throw new AppError("Unauthorized", 401, "AUTH_003");
      }

      const payload = this.createTokenPayload(user);
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      logger.info("Firebase token verified and session created", {
        userId: user.id,
        endpoint: "auth/firebase-verify",
        isNewUser,
        timestamp: new Date().toISOString()
      });

      return {
        accessToken,
        refreshToken,
        user: this.toAuthUser(user),
        isNewUser
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const firebaseStatusOnError = this.getFirebaseInitStatus();
      const errorCode =
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : "unknown";
      const errorMessage = error instanceof Error ? error.message : "Unknown auth error";

      logger.warn("Firebase authentication failed", {
        endpoint: "auth/firebase-verify",
        timestamp: new Date().toISOString(),
        firebaseInitialized: firebaseStatusOnError.initialized,
        firebaseAppCount: firebaseStatusOnError.appCount,
        errorCode,
        error: errorMessage
      });

      if (
        errorCode === "app/invalid-credential" ||
        errorCode === "auth/invalid-credential" ||
        /credential|service account|private key|client email|project id|configuration/i.test(
          errorMessage
        )
      ) {
        throw new AppError(`Firebase configuration error: ${errorMessage}`, 500, "INTERNAL_500");
      }

      throw new AppError("Invalid Firebase token", 401, "AUTH_001");
    }
  }

  public async loginWithFirebase(idToken: string): Promise<LoginResult> {
    return this.firebaseVerify(idToken);
  }

  public async refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
    try {
      const payload = verifyRefreshToken(refreshToken);

      const user = await prisma.user.findUnique({
        where: {
          id: payload.userId
        },
        select: this.userAuthSelect
      });

      if (!user || user.is_deleted) {
        throw new AppError("User not found", 404, "USER_001");
      }

      if (!user.is_active) {
        throw new AppError("Unauthorized", 401, "AUTH_003");
      }

      const newAccessToken = signAccessToken(this.createTokenPayload(user));

      logger.info("Access token refreshed", {
        userId: user.id,
        endpoint: "auth/refresh-token",
        timestamp: new Date().toISOString()
      });

      return {
        accessToken: newAccessToken,
        user: this.toAuthUser(user)
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Unauthorized", 401, "AUTH_003");
    }
  }

  public async logout(refreshToken: string): Promise<void> {
    try {
      const payload = verifyRefreshToken(refreshToken);

      logger.info("User session cleared", {
        userId: payload.userId,
        endpoint: "auth/logout",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.warn("Logout token validation failed", {
        endpoint: "auth/logout",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown logout token error"
      });

      // Logout should not reveal token validation state.
    }
  }

  public async getCurrentUserProfile(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: this.userAuthSelect
    });

    if (!user || user.is_deleted) {
      throw new AppError("User not found", 404, "USER_001");
    }

    if (!user.is_active) {
      throw new AppError("Unauthorized", 401, "AUTH_003");
    }

    return this.toAuthUser(user);
  }
}

const authService = new AuthService();

export default authService;
