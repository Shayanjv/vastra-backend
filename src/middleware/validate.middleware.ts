import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { sendError } from "../utils/response.util";

interface ValidationSchema {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

const mapIssues = (issues: { path: (string | number)[]; message: string }[]): string[] => {
  return issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`);
};

export const validateRequest = (schema: ValidationSchema) => {
  return (request: Request, response: Response, next: NextFunction): Response | void => {
    const errors: string[] = [];

    if (schema.body) {
      const parsedBody = schema.body.safeParse(request.body);

      if (!parsedBody.success) {
        errors.push(...mapIssues(parsedBody.error.issues));
      } else {
        request.body = parsedBody.data;
      }
    }

    if (schema.query) {
      const parsedQuery = schema.query.safeParse(request.query);

      if (!parsedQuery.success) {
        errors.push(...mapIssues(parsedQuery.error.issues));
      }
    }

    if (schema.params) {
      const parsedParams = schema.params.safeParse(request.params);

      if (!parsedParams.success) {
        errors.push(...mapIssues(parsedParams.error.issues));
      }
    }

    if (errors.length > 0) {
      return sendError(
        response,
        400,
        "Validation failed",
        errors.join("; "),
        "VALIDATION_001"
      );
    }

    next();
  };
};
