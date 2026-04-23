import type { JwtTokenPayload } from "../../utils/jwt.util";

declare global {
  namespace Express {
    interface Request {
      user?: JwtTokenPayload;
      requestId?: string;
    }
  }
}

export {};
