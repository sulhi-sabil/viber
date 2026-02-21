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

/**
 * Send a 429 Rate Limited error with headers
 */
export function rateLimited(
  res: VercelResponse,
  message: string,
  options?: {
    retryAfter?: number;
    limit?: number;
    remaining?: number;
    reset?: number;
  },
): void {
  // Set rate limit headers
  if (options?.limit !== undefined) {
    res.setHeader("X-RateLimit-Limit", options.limit);
  }
  if (options?.remaining !== undefined) {
    res.setHeader("X-RateLimit-Remaining", options.remaining);
  }
  if (options?.reset !== undefined) {
    res.setHeader("X-RateLimit-Reset", options.reset);
  }
  if (options?.retryAfter !== undefined) {
    res.setHeader("Retry-After", options.retryAfter);
  }

  error(res, "RATE_LIMIT_EXCEEDED", message, 429, options);
}
