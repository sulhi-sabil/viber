/**
 * HTTP Response helpers for Vercel serverless functions
 */

import type { VercelResponse } from "@vercel/node";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

/**
 * Send a JSON success response
 */
export function json<T>(res: VercelResponse, data: T, statusCode = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(response);
}

/**
 * Send a JSON error response
 */
export function error(
  res: VercelResponse,
  code: string,
  message: string,
  statusCode = 500,
  details?: unknown,
): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(response);
}

/**
 * Send a 400 Bad Request error
 */
export function badRequest(
  res: VercelResponse,
  message: string,
  details?: unknown,
): void {
  error(res, "BAD_REQUEST", message, 400, details);
}

/**
 * Send a 401 Unauthorized error
 */
export function unauthorized(
  res: VercelResponse,
  message = "Unauthorized",
): void {
  error(res, "UNAUTHORIZED", message, 401);
}

/**
 * Send a 503 Service Unavailable error (for missing env vars)
 */
export function serviceUnavailable(
  res: VercelResponse,
  message: string,
  details?: unknown,
): void {
  error(res, "SERVICE_UNAVAILABLE", message, 503, details);
}

/**
 * Send a 500 Internal Server Error
 */
export function internalError(
  res: VercelResponse,
  message: string,
  details?: unknown,
): void {
  error(res, "INTERNAL_ERROR", message, 500, details);
}
