import { v4 as uuidv4 } from "uuid";
import {
  ErrorCode,
  ErrorSeverity,
  ApiError,
  ErrorContext,
  HttpError,
} from "../types/errors";
import {
  HTTP_STATUS_UNPROCESSABLE_ENTITY,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_GATEWAY_TIMEOUT,
  HTTP_STATUS_INTERNAL_ERROR,
  HTTP_STATUS_BAD_REQUEST,
} from "../config/constants";

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
    statusCode: number = HTTP_STATUS_INTERNAL_ERROR,
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
            constructorOpt?: new (...args: unknown[]) => unknown,
          ) => void;
        }
      ).captureStackTrace
    ) {
      (
        Error as {
          captureStackTrace: (
            targetObject: object,
            constructorOpt?: new (...args: unknown[]) => unknown,
          ) => void;
        }
      ).captureStackTrace(
        this,
        this.constructor as new (...args: unknown[]) => unknown,
      );
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      ErrorCode.VALIDATION_ERROR,
      message,
      HTTP_STATUS_UNPROCESSABLE_ENTITY,
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
      HTTP_STATUS_UNAUTHORIZED,
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
      HTTP_STATUS_FORBIDDEN,
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
      HTTP_STATUS_NOT_FOUND,
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
      HTTP_STATUS_TOO_MANY_REQUESTS,
      ErrorSeverity.MEDIUM,
      true,
      { retryAfter },
      suggestion,
    );
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    service: string,
    message?: string,
    details?: Record<string, unknown>,
  ) {
    super(
      ErrorCode.SERVICE_UNAVAILABLE,
      message || `${service} is currently unavailable`,
      HTTP_STATUS_SERVICE_UNAVAILABLE,
      ErrorSeverity.HIGH,
      true,
      { service, ...details },
      `The ${service} service may be experiencing downtime. Check the service status page, retry with exponential backoff, or use a fallback mechanism if available.`,
    );
  }
}

export class TimeoutError extends AppError {
  constructor(operation: string, timeout: number) {
    super(
      ErrorCode.TIMEOUT,
      `${operation} timed out after ${timeout}ms`,
      HTTP_STATUS_GATEWAY_TIMEOUT,
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
      HTTP_STATUS_INTERNAL_ERROR,
      ErrorSeverity.HIGH,
      false,
      details,
      "This is an unexpected system error. Check application logs for details, verify service dependencies are healthy, and consider implementing graceful degradation. If the error persists, contact support with the request ID.",
    );
  }
}

export class SupabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      ErrorCode.SUPABASE_ERROR,
      message,
      HTTP_STATUS_INTERNAL_ERROR,
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
      HTTP_STATUS_INTERNAL_ERROR,
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
      HTTP_STATUS_INTERNAL_ERROR,
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

  const mergedDetails = context
    ? { ...appError.details, ...context }
    : appError.details;

  return {
    error: {
      code: appError.code || ErrorCode.INTERNAL_ERROR,
      message: appError.message || "An unexpected error occurred",
      suggestion: appError.suggestion,
      details: mergedDetails,
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
    case HTTP_STATUS_BAD_REQUEST:
      return ErrorCode.INVALID_REQUEST;
    case HTTP_STATUS_UNAUTHORIZED:
      return ErrorCode.UNAUTHORIZED;
    case HTTP_STATUS_FORBIDDEN:
      return ErrorCode.FORBIDDEN;
    case HTTP_STATUS_NOT_FOUND:
      return ErrorCode.NOT_FOUND;
    case HTTP_STATUS_UNPROCESSABLE_ENTITY:
      return ErrorCode.VALIDATION_ERROR;
    case HTTP_STATUS_TOO_MANY_REQUESTS:
      return ErrorCode.RATE_LIMIT_EXCEEDED;
    case HTTP_STATUS_INTERNAL_ERROR:
      return ErrorCode.INTERNAL_ERROR;
    case HTTP_STATUS_SERVICE_UNAVAILABLE:
      return ErrorCode.SERVICE_UNAVAILABLE;
    case HTTP_STATUS_GATEWAY_TIMEOUT:
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
