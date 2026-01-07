export enum ErrorCode {
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  SUPABASE_ERROR = 'SUPABASE_ERROR',
  GEMINI_ERROR = 'GEMINI_ERROR',
  CLOUDFLARE_ERROR = 'CLOUDFLARE_ERROR',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorDetails {
  [key: string]: any;
}

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails;
    requestId: string;
    severity: ErrorSeverity;
    timestamp: string;
  };
}

export interface ErrorContext {
  service?: string;
  operation?: string;
  params?: any;
  originalError?: any;
}

export interface HttpError extends Error {
  statusCode: number;
  code: ErrorCode;
  details?: ErrorDetails;
  requestId: string;
}

export interface ServiceConfig {
  timeout: number;
  maxRetries: number;
  circuitBreakerThreshold: number;
}
