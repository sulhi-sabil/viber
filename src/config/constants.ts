/**
 * Shared constants for the integration layer
 * Centralizes magic numbers and configuration defaults
 */

// ============================================================================
// Timeout Constants (in milliseconds)
// ============================================================================

/** Default timeout for API operations */
export const DEFAULT_OPERATION_TIMEOUT_MS = 10000;

/** Default timeout for health checks */
export const HEALTH_CHECK_TIMEOUT_MS = 5000;

/** Default timeout for streaming operations */
export const STREAMING_TIMEOUT_MS = 30000;

// ============================================================================
// Retry Configuration
// ============================================================================

/** Default maximum retry attempts */
export const DEFAULT_MAX_RETRY_ATTEMPTS = 3;

/** Default initial delay between retries (ms) */
export const DEFAULT_RETRY_INITIAL_DELAY_MS = 1000;

/** Default maximum delay between retries (ms) */
export const DEFAULT_RETRY_MAX_DELAY_MS = 10000;

/** Default backoff multiplier for retries */
export const DEFAULT_RETRY_BACKOFF_MULTIPLIER = 2;

/** HTTP status codes that trigger automatic retry */
export const RETRYABLE_HTTP_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/** Network error codes that trigger automatic retry */
export const RETRYABLE_ERROR_CODES = [
  "ECONNRESET", // Connection reset by peer
  "ECONNREFUSED", // Connection refused
  "ETIMEDOUT", // Operation timed out
  "ENOTFOUND", // DNS lookup failed
];

// ============================================================================
// Circuit Breaker Configuration
// ============================================================================

/** Default failure threshold before opening circuit */
export const CIRCUIT_BREAKER_DEFAULT_FAILURE_THRESHOLD = 5;

/** Default reset timeout for circuit breaker (ms) */
export const CIRCUIT_BREAKER_DEFAULT_RESET_TIMEOUT_MS = 60000;

/** Default maximum calls in half-open state */
export const CIRCUIT_BREAKER_DEFAULT_HALF_OPEN_MAX_CALLS = 3;

/** Default monitoring window for circuit breaker (ms) */
export const CIRCUIT_BREAKER_DEFAULT_MONITOR_WINDOW_MS = 60000;

/** Minimum cleanup threshold for circuit breaker metrics */
export const CIRCUIT_BREAKER_MIN_CLEANUP_THRESHOLD = 50;

/** Cleanup threshold multiplier based on failure threshold */
export const CIRCUIT_BREAKER_CLEANUP_THRESHOLD_MULTIPLIER = 10;

// ============================================================================
// Rate Limiter Configuration
// ============================================================================

/** Default maximum requests per window */
export const RATE_LIMITER_DEFAULT_MAX_REQUESTS = 15;

/** Default time window for rate limiting (ms) */
export const RATE_LIMITER_DEFAULT_WINDOW_MS = 60000;

/** Minimum cleanup threshold for rate limiter */
export const RATE_LIMITER_MIN_CLEANUP_THRESHOLD = 100;

/** Cleanup threshold multiplier based on max requests */
export const RATE_LIMITER_CLEANUP_THRESHOLD_MULTIPLIER = 2;

// ============================================================================
// Validation Constants
// ============================================================================

/** Minimum length for API keys */
export const MIN_API_KEY_LENGTH = 10;

/** Maximum length for slugs */
export const MAX_SLUG_LENGTH = 255;

/** Maximum length for content type names */
export const MAX_CONTENT_TYPE_NAME_LENGTH = 255;

/** Maximum length for entry titles */
export const MAX_ENTRY_TITLE_LENGTH = 500;

/** Maximum length for filenames */
export const MAX_FILENAME_LENGTH = 500;

/** Maximum length for R2 storage keys */
export const MAX_R2_KEY_LENGTH = 500;

// ============================================================================
// Pagination Constants
// ============================================================================

/** Default limit for pagination queries */
export const DEFAULT_PAGINATION_LIMIT = 10;

/** Maximum allowed pagination limit */
export const MAX_PAGINATION_LIMIT = 1000;

// ============================================================================
// Idempotency Configuration
// ============================================================================

/** Default TTL for idempotency cache (24 hours in ms) */
export const IDEMPOTENCY_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Logger Configuration
// ============================================================================

/** Maximum depth for log object sanitization */
export const LOGGER_MAX_SANITIZATION_DEPTH = 5;

/** Maximum keys to process during log sanitization */
export const LOGGER_MAX_SANITIZATION_KEYS = 100;

/** Maximum array items to log */
export const LOGGER_MAX_ARRAY_ITEMS = 10;

/** Pattern matching cache size for sanitization */
export const LOGGER_SANITIZATION_CACHE_SIZE = 1000;

/** Maximum object keys to process per level during log sanitization */
export const LOGGER_MAX_OBJECT_KEYS_PER_LEVEL = 50;

// ============================================================================
// Security Constants
// ============================================================================

/** Prefix length for logging API keys (for debugging) */
export const API_KEY_PREFIX_LENGTH = 8;
