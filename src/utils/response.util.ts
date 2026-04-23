import type { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface SuccessApiResponse<T> {
  success: true;
  message: string;
  data: T;
  pagination: PaginationMeta;
  timestamp: string;
}

export interface ErrorApiResponse {
  success: false;
  message: string;
  error: string;
  code: string;
  timestamp: string;
}

const defaultPaginationFromData = (data: unknown): PaginationMeta => {
  if (Array.isArray(data)) {
    return {
      page: 1,
      limit: data.length,
      total: data.length
    };
  }

  return {
    page: 1,
    limit: 1,
    total: data ? 1 : 0
  };
};

export const sendSuccess = <T>(
  response: Response,
  statusCode: number,
  message: string,
  data: T,
  pagination?: PaginationMeta
): Response<SuccessApiResponse<T>> => {
  const resolvedPagination = pagination ?? defaultPaginationFromData(data);

  return response.status(statusCode).json({
    success: true,
    message,
    data,
    pagination: resolvedPagination,
    timestamp: new Date().toISOString()
  });
};

export const sendError = (
  response: Response,
  statusCode: number,
  message: string,
  error: string,
  code: string
): Response<ErrorApiResponse> => {
  return response.status(statusCode).json({
    success: false,
    message,
    error,
    code,
    timestamp: new Date().toISOString()
  });
};
