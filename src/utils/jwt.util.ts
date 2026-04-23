import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import environment from "../config/environment";
import { AppError } from "./error.util";

export interface JwtTokenPayload {
  userId: string;
  firebaseUid: string;
  email: string;
  tier: "FREE" | "PREMIUM";
}

const accessTokenExpiresIn = environment.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"];
const refreshTokenExpiresIn = environment.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"];

export const signAccessToken = (payload: JwtTokenPayload): string => {
  return jwt.sign(payload, environment.JWT_ACCESS_SECRET, {
    expiresIn: accessTokenExpiresIn
  });
};

export const signRefreshToken = (payload: JwtTokenPayload): string => {
  return jwt.sign(payload, environment.JWT_REFRESH_SECRET, {
    expiresIn: refreshTokenExpiresIn
  });
};

const extractJwtPayload = (decoded: string | JwtPayload): JwtPayload => {
  if (typeof decoded === "string") {
    throw new AppError("Invalid token payload", 401, "AUTH_003");
  }

  return decoded;
};

const toJwtTokenPayload = (decodedPayload: JwtPayload): JwtTokenPayload => {
  const userId = decodedPayload["userId"];
  const firebaseUid = decodedPayload["firebaseUid"];
  const email = decodedPayload["email"];
  const tier = decodedPayload["tier"];

  if (
    typeof userId !== "string" ||
    typeof firebaseUid !== "string" ||
    typeof email !== "string" ||
    (tier !== "FREE" && tier !== "PREMIUM")
  ) {
    throw new AppError("Invalid token payload", 401, "AUTH_003");
  }

  return {
    userId,
    firebaseUid,
    email,
    tier
  };
};

export const verifyAccessToken = (token: string): JwtTokenPayload => {
  try {
    const decoded = jwt.verify(token, environment.JWT_ACCESS_SECRET);
    const decodedPayload = extractJwtPayload(decoded);

    return toJwtTokenPayload(decodedPayload);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError("Access token expired", 401, "AUTH_002");
    }

    throw new AppError("Invalid access token", 401, "AUTH_001");
  }
};

export const verifyRefreshToken = (token: string): JwtTokenPayload => {
  try {
    const decoded = jwt.verify(token, environment.JWT_REFRESH_SECRET);
    const decodedPayload = extractJwtPayload(decoded);

    return toJwtTokenPayload(decodedPayload);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError("Refresh token expired", 401, "AUTH_002");
    }

    throw new AppError("Invalid refresh token", 401, "AUTH_001");
  }
};
