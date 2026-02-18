import { v4 as uuidv4 } from "uuid";
import {
  ErrorCode,
  ErrorSeverity,
  ApiError,
  ErrorContext,
  HttpError,
} from "../types/errors";

export { ErrorCode, ErrorSeverity };

export class AppError extends Error implements HttpError {
  statusCode: number;
  code: ErrorCode;
  details?: Record<string, unknown>;
  requestId: string;
  severity: ErrorSeverity;
  isOperational: boolean;
  suggestion?: string;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    isOperational: boolean = true,
    details?: Record<string, unknown>,
    suggestion?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.severity = severity;
    this.details = details;
    this.requestId = uuidv4();
    this.isOperational = isOperational;
    this.suggestion = suggestion;

    if (
      (
        Error as {
          captureStackTrace?: (
            targetObject: object,
            constructorOpt?: new (...args: any[]) => any,
          ) => void;
        }
      ).captureStackTrace
    ) {
      (
        Error as {
          captureStackTrace: (
            targetObject: object,
            constructorOpt?: new (...args: any[]) => any,
          ) => void;
        }
      ).captureStackTrace(
        this,
        this.constructor as new (...args: any[]) => any,
      );
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      ErrorCode.VALIDATION_ERROR,
      message,
      422,
      ErrorSeverity.LOW,
      true,
      details,
      "Check the input data format and ensure all required fields are provided correctly. Review the API documentation for valid field types and formats.",
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized access") {
    super(
      ErrorCode.UNAUTHORIZED,
      message,
      401,
      ErrorSeverity.MEDIUM,
      true,
      undefined,
      "Verify your API key or authentication token is correct and has not expired. Check that the authorization header is properly formatted.",
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(
      ErrorCode.FORBIDDEN,
      message,
      403,
      ErrorSeverity.MEDIUM,
      true,
      undefined,
      "Verify your account has the necessary permissions for this resource. Check your role assignments and contact your administrator if you need elevated access.",
    );
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(
      ErrorCode.NOT_FOUND,
      `${resource} not found`,
      404,
      ErrorSeverity.LOW,
      true,
      undefined,
      `Verify the ${resource} identifier is correct and the resource exists. Check for typos in IDs or slugs, and ensure the resource hasn't been deleted.`,
    );
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Rate limit exceeded", retryAfter?: number) {
    const suggestion = retryAfter
      ? `Wait ${retryAfter} seconds before retrying, or implement exponential backoff with jitter to spread out requests.`
      : "Reduce your request frequency, implement request batching, or contact support to increase your rate limit quota.";

    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      message,
      429,
      ErrorSeverity.MEDIUM,
      true,
      { retryAfter },
      suggestion,
    );
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string, message?: string) {
    super(
      ErrorCode.SERVICE_UNAVAILABLE,
      message || `${service} is currently unavailable`,
      503,
      ErrorSeverity.HIGH,
      true,
      { service },
      `The ${service} service may be experiencing downtime. Check the service status page, retry with exponential backoff, or use a fallback mechanism if available.`,
    );
  }
}

export class TimeoutError extends AppError {
  constructor(operation: string, timeout: number) {
    super(
      ErrorCode.TIMEOUT,
      `${operation} timed out after ${timeout}ms`,
      504,
      ErrorSeverity.HIGH,
      true,
      { operation, timeout },
      `Consider increasing the timeout value, optimizing the ${operation} operation, or checking network connectivity. For slow operations, implement async processing with status polling.`,
    );
  }
}

export class InternalError extends AppError {
  constructor(
    message: string = "An unexpected error occurred",
    details?: Record<string, unknown>,
  ) {
    super(
      ErrorCode.INTERNAL_ERROR,
      message,
      500,
      ErrorSeverity.HIGH,
      false,
      details,
    );
  }
}

export class SupabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      ErrorCode.SUPABASE_ERROR,
      message,
      500,
      ErrorSeverity.HIGH,
      true,
      details,
      "Check your Supabase connection settings, verify the table/column names exist, and ensure RLS policies allow the operation. Review the error details for specific database constraints.",
    );
  }
}

export class GeminiError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      ErrorCode.GEMINI_ERROR,
      message,
      500,
      ErrorSeverity.HIGH,
      true,
      details,
      "Verify your Gemini API key is valid and has sufficient quota. Check that your prompt meets content safety guidelines and isn't too long. Consider implementing retry logic for transient failures.",
    );
  }
}

export class CloudflareError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      ErrorCode.CLOUDFLARE_ERROR,
      message,
      500,
      ErrorSeverity.HIGH,
      true,
      details,
      "Verify your Cloudflare API token has the correct permissions (Zone:Read, Page Rules:Edit). Check that the zone ID is correct and the API token hasn't expired. Review Cloudflare's API documentation for rate limits and valid request formats.",
    );
  }
}

export function createApiError(
  error: Error | AppError,
  context?: ErrorContext,
): ApiError {
  const appError = error as AppError;
  const requestId = appError.requestId || uuidv4();

  return {
    error: {
      code: appError.code || ErrorCode.INTERNAL_ERROR,
      message: appError.message || "An unexpected error occurred",
      suggestion: appError.suggestion,
      details: appError.details || context,
      requestId,
      severity: appError.severity || ErrorSeverity.MEDIUM,
      timestamp: new Date().toISOString(),
    },
  };
}

export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

export function mapHttpStatusCodeToErrorCode(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400:
      return ErrorCode.INVALID_REQUEST;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 422:
      return ErrorCode.VALIDATION_ERROR;
    case 429:
      return ErrorCode.RATE_LIMIT_EXCEEDED;
    case 500:
      return ErrorCode.INTERNAL_ERROR;
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE;
    case 504:
      return ErrorCode.TIMEOUT;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

export function wrapError(
  error: Error | unknown,
  message?: string,
  errorCode?: ErrorCode,
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const errorObj = error instanceof Error ? error : new Error(String(error));

  if (message) {
    return new InternalError(message, {
      originalError: errorObj.message,
      stack: errorObj.stack,
    });
  }

  return new InternalError(errorObj.message || "An unexpected error occurred", {
    originalError: errorObj.message,
    stack: errorObj.stack,
    code: errorCode,
  });
}
