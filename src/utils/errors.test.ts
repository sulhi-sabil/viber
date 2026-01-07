import {
  ValidationError,
  UnauthorizedError,
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
});
