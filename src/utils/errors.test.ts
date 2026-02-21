import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  TimeoutError,
  InternalError,
  SupabaseError,
  GeminiError,
  CloudflareError,
  createApiError,
  isOperationalError,
  mapHttpStatusCodeToErrorCode,
  wrapError,
  ErrorCode,
  ErrorSeverity,
} from "../utils/errors";
import { ErrorContext } from "../types/errors";

describe("Error Classes", () => {
  it("should create ValidationError with correct properties", () => {
    const error = new ValidationError("Invalid input");

    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe("Invalid input");
    expect(error.statusCode).toBe(422);
    expect(error.severity).toBe(ErrorSeverity.LOW);
    expect(error.isOperational).toBe(true);
    expect(error.requestId).toBeDefined();
  });

  it("should create UnauthorizedError with correct properties", () => {
    const error = new UnauthorizedError("Not authorized");

    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(error.statusCode).toBe(401);
    expect(error.severity).toBe(ErrorSeverity.MEDIUM);
  });

  it("should create NotFoundError with correct properties", () => {
    const error = new NotFoundError("User");

    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.message).toBe("User not found");
    expect(error.statusCode).toBe(404);
  });

  it("should create RateLimitError with details", () => {
    const error = new RateLimitError("Too many requests", 60);

    expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(error.statusCode).toBe(429);
    expect(error.details).toEqual({ retryAfter: 60 });
  });

  it("should create ServiceUnavailableError for specific service", () => {
    const error = new ServiceUnavailableError("Supabase");

    expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    expect(error.message).toBe("Supabase is currently unavailable");
    expect(error.statusCode).toBe(503);
    expect(error.severity).toBe(ErrorSeverity.HIGH);
  });

  it("should create TimeoutError with timeout info", () => {
    const error = new TimeoutError("API call", 5000);

    expect(error.code).toBe(ErrorCode.TIMEOUT);
    expect(error.statusCode).toBe(504);
    expect(error.message).toBe("API call timed out after 5000ms");
    expect(error.severity).toBe(ErrorSeverity.HIGH);
  });

  it("should create InternalError with details", () => {
    const details = { userId: 123, action: "create" };
    const error = new InternalError("Database error", details);

    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.isOperational).toBe(false);
    expect(error.details).toEqual(details);
  });

  it("should create AppError with default statusCode", () => {
    const error = new AppError(ErrorCode.VALIDATION_ERROR, "Test error");

    expect(error.statusCode).toBe(500);
  });

  it("should create AppError with default severity", () => {
    const error = new AppError(ErrorCode.VALIDATION_ERROR, "Test error", 404);

    expect(error.severity).toBe(ErrorSeverity.MEDIUM);
  });

  it("should create RateLimitError with default message", () => {
    const error = new RateLimitError();

    expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(error.message).toBe("Rate limit exceeded");
    expect(error.statusCode).toBe(429);
    expect(error.details).toEqual({ retryAfter: undefined });
  });

  it("should create InternalError with default message", () => {
    const error = new InternalError();

    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.message).toBe("An unexpected error occurred");
    expect(error.isOperational).toBe(false);
  });
});

describe("Service-Specific Errors", () => {
  it("should create SupabaseError", () => {
    const error = new SupabaseError("Connection failed");

    expect(error.code).toBe(ErrorCode.SUPABASE_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.severity).toBe(ErrorSeverity.HIGH);
  });

  it("should create GeminiError", () => {
    const error = new GeminiError("AI generation failed");

    expect(error.code).toBe(ErrorCode.GEMINI_ERROR);
    expect(error.statusCode).toBe(500);
  });

  it("should create CloudflareError", () => {
    const error = new CloudflareError("Deployment failed");

    expect(error.code).toBe(ErrorCode.CLOUDFLARE_ERROR);
    expect(error.statusCode).toBe(500);
  });
});

describe("createApiError", () => {
  it("should create standardized API error from AppError", () => {
    const appError = new ValidationError("Invalid data");
    const apiError = createApiError(appError);

    expect(apiError.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(apiError.error.message).toBe("Invalid data");
    expect(apiError.error.requestId).toBeDefined();
    expect(apiError.error.timestamp).toBeDefined();
    expect(apiError.error.severity).toBe(ErrorSeverity.LOW);
  });

  it("should create API error with context", () => {
    const appError = new ValidationError("Invalid email");
    const context: ErrorContext = {
      service: "AuthService",
      operation: "login",
    };
    const apiError = createApiError(appError, context);

    expect(apiError.error.details).toEqual(context);
  });

  it("should handle regular Error objects", () => {
    const error = new Error("Unexpected error");
    const apiError = createApiError(error);

    expect(apiError.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(apiError.error.message).toBe("Unexpected error");
  });

  it("should handle AppError with undefined code", () => {
    const error = new Error("Test error") as Error & { code?: ErrorCode; isOperational?: boolean };
    delete error.code;
    error.isOperational = true;
    const apiError = createApiError(error);

    expect(apiError.error.code).toBe(ErrorCode.INTERNAL_ERROR);
  });
});

describe("isOperationalError", () => {
  it("should return true for operational errors", () => {
    const error = new ValidationError("Invalid input");
    expect(isOperationalError(error)).toBe(true);
  });

  it("should return false for non-operational errors", () => {
    const error = new InternalError("Critical failure");
    expect(isOperationalError(error)).toBe(false);
  });

  it("should return false for regular errors", () => {
    const error = new Error("Regular error");
    expect(isOperationalError(error)).toBe(false);
  });
});

describe("mapHttpStatusCodeToErrorCode", () => {
  it("should map 400 to INVALID_REQUEST", () => {
    expect(mapHttpStatusCodeToErrorCode(400)).toBe(ErrorCode.INVALID_REQUEST);
  });

  it("should map 401 to UNAUTHORIZED", () => {
    expect(mapHttpStatusCodeToErrorCode(401)).toBe(ErrorCode.UNAUTHORIZED);
  });

  it("should map 404 to NOT_FOUND", () => {
    expect(mapHttpStatusCodeToErrorCode(404)).toBe(ErrorCode.NOT_FOUND);
  });

  it("should map 429 to RATE_LIMIT_EXCEEDED", () => {
    expect(mapHttpStatusCodeToErrorCode(429)).toBe(
      ErrorCode.RATE_LIMIT_EXCEEDED,
    );
  });

  it("should map 500 to INTERNAL_ERROR", () => {
    expect(mapHttpStatusCodeToErrorCode(500)).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it("should map unknown codes to INTERNAL_ERROR", () => {
    expect(mapHttpStatusCodeToErrorCode(418)).toBe(ErrorCode.INTERNAL_ERROR);
  });
});

describe("wrapError", () => {
  it("should return AppError as is", () => {
    const appError = new ValidationError("Invalid");
    const wrapped = wrapError(appError);

    expect(wrapped).toBe(appError);
  });

  it("should wrap regular Error with custom message", () => {
    const error = new Error("Network error");
    const wrapped = wrapError(error, "Failed to connect");

    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.message).toBe("Failed to connect");
    expect(wrapped.details?.originalError).toBe("Network error");
  });

  it("should wrap Error with original message if no custom message", () => {
    const error = new Error("Something went wrong");
    const wrapped = wrapError(error);

    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.message).toBe("Something went wrong");
  });

  it("should wrap Error with custom error code and no custom message", () => {
    const error = new Error("Custom error");
    const wrapped = wrapError(error, undefined, ErrorCode.VALIDATION_ERROR);

    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.message).toBe("Custom error");
    expect(wrapped.details).toEqual({
      originalError: "Custom error",
      stack: expect.any(String),
      code: ErrorCode.VALIDATION_ERROR,
    });
  });

  it("should wrap Error with custom message and error code (message path)", () => {
    const error = new Error("Custom error");
    const wrapped = wrapError(
      error,
      "Failed to process",
      ErrorCode.VALIDATION_ERROR,
    );

    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.message).toBe("Failed to process");
    expect(wrapped.details).toEqual({
      originalError: "Custom error",
      stack: expect.any(String),
    });
  });
});

describe("Edge Cases", () => {
  it("should handle empty error message", () => {
    const error = new ValidationError("");

    expect(error.message).toBe("");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("should handle very long error message", () => {
    const longMessage = "a".repeat(10000);
    const error = new ValidationError(longMessage);

    expect(error.message).toBe(longMessage);
  });

  it("should handle error with circular reference in details", () => {
    const details: Record<string, unknown> = { key: "value" };
    details.circular = details;

    const error = new ValidationError("Invalid data", details);

    expect(error.details).toBeDefined();
    expect(error.details?.key).toBe("value");
  });

  it("should handle wrapping non-Error objects", () => {
    const error = "string error";
    const wrapped = wrapError(error);

    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.message).toBe("string error");
  });

  it("should handle wrapping null", () => {
    const wrapped = wrapError(null);

    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.message).toBe("null");
  });

  it("should handle wrapping undefined", () => {
    const wrapped = wrapError(undefined);

    expect(wrapped).toBeInstanceOf(InternalError);
  });

  it("should handle wrapping number", () => {
    const wrapped = wrapError(500);

    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.message).toBe("500");
  });

  it("should handle wrapping object without message", () => {
    const error = { code: "ERROR_CODE" };
    const wrapped = wrapError(error);

    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.details?.originalError).toBeDefined();
  });

  it("should generate unique requestId for each error", () => {
    const error1 = new ValidationError("Error 1");
    const error2 = new ValidationError("Error 2");

    expect(error1.requestId).not.toBe(error2.requestId);
  });

  it("should handle rate limit error with 0 retryAfter", () => {
    const error = new RateLimitError("Rate limited", 0);

    expect(error.details).toEqual({ retryAfter: 0 });
  });

  it("should handle rate limit error with very large retryAfter", () => {
    const error = new RateLimitError("Rate limited", 999999);

    expect(error.details).toEqual({ retryAfter: 999999 });
  });

  it("should handle timeout error with 0 timeout", () => {
    const error = new TimeoutError("operation", 0);

    expect(error.message).toBe("operation timed out after 0ms");
  });

  it("should handle timeout with very large timeout", () => {
    const error = new TimeoutError("operation", Number.MAX_SAFE_INTEGER);

    expect(error.message).toContain("operation timed out");
  });

  it("should handle createApiError with null context", () => {
    const appError = new ValidationError("Invalid data");
    const apiError = createApiError(appError, undefined);

    expect(apiError.error.details).toEqual(appError.details);
  });

  it("should handle createApiError with empty context", () => {
    const appError = new ValidationError("Invalid data");
    const apiError = createApiError(appError, {});

    expect(apiError.error.details).toEqual({});
  });

  it("should handle mapHttpStatusCodeToErrorCode with 0", () => {
    const code = mapHttpStatusCodeToErrorCode(0);

    expect(code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it("should handle mapHttpStatusCodeToErrorCode with very large code", () => {
    const code = mapHttpStatusCodeToErrorCode(9999);

    expect(code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it("should handle mapHttpStatusCodeToErrorCode with negative code", () => {
    const code = mapHttpStatusCodeToErrorCode(-1);

    expect(code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it("should preserve stack trace in wrapped errors", () => {
    const originalError = new Error("Original");
    const wrapped = wrapError(originalError);

    expect(wrapped.details?.stack).toBe(originalError.stack);
  });

  it("should handle error without stack trace", () => {
    const error: Error = { message: "Test error", name: "Error" } as Error;
    const wrapped = wrapError(error);

    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.details?.stack).toBeDefined();
  });

  it("should handle wrapping error with custom error code", () => {
    const error = new Error("Custom error");
    const wrapped = wrapError(
      error,
      "Custom message",
      ErrorCode.VALIDATION_ERROR,
    );

    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.message).toBe("Custom message");
  });

  it("should handle isOperationalError with inherited errors", () => {
    const error = Object.create(new ValidationError("Base error"));

    expect(isOperationalError(error)).toBe(true);
  });

  it("should handle error class with default severity", () => {
    const error = new ValidationError("Test");

    expect(error.severity).toBe(ErrorSeverity.LOW);
  });

  it("should use default message for ForbiddenError", () => {
    const error = new ForbiddenError();

    expect(error.message).toBe("Forbidden");
  });

  it("should use default message for UnauthorizedError", () => {
    const error = new UnauthorizedError();

    expect(error.message).toBe("Unauthorized access");
  });

  it("should map 403 to FORBIDDEN", () => {
    expect(mapHttpStatusCodeToErrorCode(403)).toBe(ErrorCode.FORBIDDEN);
  });

  it("should map 422 to VALIDATION_ERROR", () => {
    expect(mapHttpStatusCodeToErrorCode(422)).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("should map 503 to SERVICE_UNAVAILABLE", () => {
    expect(mapHttpStatusCodeToErrorCode(503)).toBe(
      ErrorCode.SERVICE_UNAVAILABLE,
    );
  });

  it("should map 504 to TIMEOUT", () => {
    expect(mapHttpStatusCodeToErrorCode(504)).toBe(ErrorCode.TIMEOUT);
  });
});
