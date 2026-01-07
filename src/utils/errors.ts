import { v4 as uuidv4 } from 'uuid';
import {
  ErrorCode,
  ErrorSeverity,
  ApiError,
  ErrorContext,
  HttpError,
} from '../types/errors';

export { ErrorCode, ErrorSeverity };

export class AppError extends Error implements HttpError {
  statusCode: number;
  code: ErrorCode;
  details?: any;
  requestId: string;
  severity: ErrorSeverity;
  isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.severity = severity;
    this.details = details;
    this.requestId = uuidv4();
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(
      ErrorCode.VALIDATION_ERROR,
      message,
      422,
      ErrorSeverity.LOW,
      true,
      details
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(
      ErrorCode.UNAUTHORIZED,
      message,
      401,
      ErrorSeverity.MEDIUM
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(
      ErrorCode.FORBIDDEN,
      message,
      403,
      ErrorSeverity.MEDIUM
    );
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(
      ErrorCode.NOT_FOUND,
      `${resource} not found`,
      404,
      ErrorSeverity.LOW
    );
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      message,
      429,
      ErrorSeverity.MEDIUM,
      true,
      { retryAfter }
    );
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string, message?: string) {
    super(
      ErrorCode.SERVICE_UNAVAILABLE,
      message || `${service} is currently unavailable`,
      503,
      ErrorSeverity.HIGH
    );
  }
}

export class TimeoutError extends AppError {
  constructor(operation: string, timeout: number) {
    super(
      ErrorCode.TIMEOUT,
      `${operation} timed out after ${timeout}ms`,
      504,
      ErrorSeverity.HIGH
    );
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'An unexpected error occurred', details?: any) {
    super(
      ErrorCode.INTERNAL_ERROR,
      message,
      500,
      ErrorSeverity.HIGH,
      false,
      details
    );
  }
}

export class SupabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(
      ErrorCode.SUPABASE_ERROR,
      message,
      500,
      ErrorSeverity.HIGH,
      true,
      details
    );
  }
}

export class GeminiError extends AppError {
  constructor(message: string, details?: any) {
    super(
      ErrorCode.GEMINI_ERROR,
      message,
      500,
      ErrorSeverity.HIGH,
      true,
      details
    );
  }
}

export class CloudflareError extends AppError {
  constructor(message: string, details?: any) {
    super(
      ErrorCode.CLOUDFLARE_ERROR,
      message,
      500,
      ErrorSeverity.HIGH,
      true,
      details
    );
  }
}

export function createApiError(
  error: Error | AppError,
  context?: ErrorContext
): ApiError {
  const appError = error as AppError;
  const requestId = appError.requestId || uuidv4();

  return {
    error: {
      code: appError.code || ErrorCode.INTERNAL_ERROR,
      message: appError.message || 'An unexpected error occurred',
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
  error: any,
  message?: string,
  errorCode?: ErrorCode
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (message) {
    return new InternalError(message, {
      originalError: error.message,
      stack: error.stack,
    });
  }

  return new InternalError(error.message || 'An unexpected error occurred', {
    originalError: error.message,
    stack: error.stack,
    code: errorCode,
  });
}
