/**
 * HTTP Response helpers for Vercel serverless functions
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "crypto";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  requestId?: string;
}

/**
 * Get or generate a request ID for tracing
 * Uses existing X-Request-Id header if present, otherwise generates a new UUID
 */
export function getRequestId(req: VercelRequest): string {
  const existingId = req.headers["x-request-id"];
  if (typeof existingId === "string" && existingId) {
    return existingId;
  }
  return `req_${randomUUID()}`;
}

/**
 * Set X-Request-Id header on response
 */
export function setRequestIdHeader(
  res: VercelResponse,
  requestId: string,
): void {
  res.setHeader("X-Request-Id", requestId);
}

/**
 * Send a JSON success response with request tracing
 */
export function json<T>(
  res: VercelResponse,
  data: T,
  statusCode = 200,
  requestId?: string,
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId }),
  };
  if (requestId) {
    setRequestIdHeader(res, requestId);
  }
  res.status(statusCode).json(response);
}

/**
 * Send a JSON error response with request tracing
 */
export function error(
  res: VercelResponse,
  code: string,
  message: string,
  statusCode = 500,
  details?: unknown,
  requestId?: string,
): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId }),
  };
  if (requestId) {
    setRequestIdHeader(res, requestId);
  }
  res.status(statusCode).json(response);
}

/**
 * Send a 400 Bad Request error
 */
export function badRequest(
  res: VercelResponse,
  message: string,
  details?: unknown,
  requestId?: string,
): void {
  error(res, "BAD_REQUEST", message, 400, details, requestId);
}

/**
 * Send a 401 Unauthorized error
 */
export function unauthorized(
  res: VercelResponse,
  message = "Unauthorized",
  requestId?: string,
): void {
  error(res, "UNAUTHORIZED", message, 401, undefined, requestId);
}

/**
 * Send a 503 Service Unavailable error (for missing env vars)
 */
export function serviceUnavailable(
  res: VercelResponse,
  message: string,
  details?: unknown,
  requestId?: string,
): void {
  error(res, "SERVICE_UNAVAILABLE", message, 503, details, requestId);
}

/**
 * Send a 500 Internal Server Error
 */
export function internalError(
  res: VercelResponse,
  message: string,
  details?: unknown,
  requestId?: string,
): void {
  error(res, "INTERNAL_ERROR", message, 500, details, requestId);
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
  requestId?: string,
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

  error(res, "RATE_LIMIT_EXCEEDED", message, 429, options, requestId);
}
