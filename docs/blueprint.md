# Integration Blueprint

## External Services & APIs

| Service        | Purpose             | Authentication                        | Rate Limits   |
| -------------- | ------------------- | ------------------------------------- | ------------- |
| **Supabase**   | Database & Auth     | VITE_SUPABASE_URL + SUPABASE_ANON_KEY | Per plan      |
| **Cloudflare** | Hosting & CDN       | CLOUDFLARE_ACCOUNT_ID + API_TOKEN     | Per plan      |
| **Gemini AI**  | AI/LLM operations   | GEMINI_API_KEY                        | 15 RPM (free) |
| **IFlow API**  | Unknown integration | IFLOW_API_KEY                         | TBD           |

## API Standards

### Naming Conventions

- **Endpoints**: `/api/{version}/{resource}` (e.g., `/api/v1/users`)
- **Methods**: GET (read), POST (create), PUT (update), DELETE (remove)
- **Parameters**: `camelCase` for query params, `snake_case` for database fields
- **Response Fields**: `camelCase` for JSON responses

### Error Response Format

```typescript
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... },
    "requestId": "uuid"
  }
}
```

**Implementation Status**: ✅ Complete

The error handling system is fully implemented:

- **Location**: `src/utils/errors.ts` and `src/types/errors.ts`
- **Features**:
  - Standardized error class hierarchy
  - Error code mapping for all services
  - Request ID generation for tracking
  - Error severity levels
  - Operational vs non-operational error distinction
  - Builder function for API error responses
  - Service-specific error classes (SupabaseError, GeminiError, CloudflareError)
- **Testing**: Full test coverage

**Usage Example**:

```typescript
import {
  ValidationError,
  NotFoundError,
  ServiceUnavailableError,
  createApiError,
} from "./utils/errors";

throw new ValidationError("Invalid email format", { field: "email" });

throw new NotFoundError("User");

const apiErrorResponse = createApiError(
  new ServiceUnavailableError("Database"),
  { operation: "fetchUser" },
);
```

### Standard HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Successful deletion
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid auth
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource doesn't exist
- `422 Unprocessable Entity` - Validation failed
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Unexpected error
- `503 Service Unavailable` - Service down

## Resilience Patterns

### Timeout Configuration

| Service    | Timeout | Reason              |
| ---------- | ------- | ------------------- |
| Supabase   | 10000ms | Database operations |
| Gemini AI  | 30000ms | AI generation       |
| Cloudflare | 5000ms  | API calls           |
| IFlow API  | 10000ms | TBD                 |

### Retry Strategy

```typescript
const retryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // ms
  maxDelay: 10000, // ms
  backoffMultiplier: 2, // Exponential
  retryableErrors: [408, 429, 500, 502, 503, 504],
};
```

**Implementation Status**: ✅ Complete

The retry logic with exponential backoff is fully implemented:

- **Location**: `src/utils/retry.ts`
- **Features**:
  - Configurable retry attempts and delays
  - Exponential backoff with configurable multiplier
  - Max delay cap to prevent excessive waiting
  - Retryable error detection (HTTP status codes and error codes)
  - Operation timeout support (`withTimeout`)
  - Callback hooks for retry attempts
- **Testing**: Full test coverage for retry scenarios

**Usage Example**:

```typescript
import { retry, withTimeout } from "./utils/retry";

async function callExternalAPI() {
  return await retry(
    async () => {
      return await withTimeout(
        fetch("https://api.example.com/data"),
        10000,
        "External API call",
      );
    },
    {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      onRetry: (attempt, error) => {
        logger.warn(`Retry attempt ${attempt}`, { error: error.message });
      },
    },
  );
}
```

### Circuit Breaker

```typescript
const circuitBreaker = {
  failureThreshold: 5, // Open after 5 failures
  resetTimeout: 60000, // Try again after 60s
  halfOpenMaxCalls: 3, // Test with 3 calls
  monitorWindow: 60000, // Evaluate over last 60s
};
```

**Implementation Status**: ✅ Complete

The circuit breaker pattern is fully implemented as a reusable utility:

- **Location**: `src/utils/circuit-breaker.ts`
- **State Machine**: CLOSED → OPEN → HALF_OPEN → CLOSED
- **Configuration**: Customizable thresholds per service
- **Monitoring**: Built-in metrics tracking (failures, successes, state transitions)
- **Testing**: Full test coverage including state transitions, metrics, and recovery

**Usage Example**:

```typescript
import { createCircuitBreaker } from "./utils/circuit-breaker";

const supabaseBreaker = createCircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000,
  onStateChange: (state, reason) => {
    logger.info(`Circuit breaker state: ${state}`, { reason });
  },
});

async function fetchFromSupabase() {
  return supabaseBreaker.execute(async () => {
    // Supabase operation here
    return await supabase.from("users").select("*");
  });
}
```

## API Versioning

- Current: `v1`
- Path-based versioning: `/api/v1/...`
- Deprecation notice in response headers: `X-API-Deprecated: true`
- Sunset header: `Sunset: YYYY-MM-DD`

## Security

### Authentication

- **Supabase**: Uses JWT (anon key for client, service_role for server)
- **Internal APIs**: API keys stored in environment variables
- **User-facing APIs**: Supabase Auth session

### Headers

```
Authorization: Bearer {token}
X-Request-ID: {uuid}
Content-Type: application/json
```

## Rate Limiting

### Client-Side (Supabase)

- Per IP: 100 requests/minute
- Per user: 1000 requests/hour
- Burst: 10 requests/second

### Internal API Protection

```typescript
const rateLimitConfig = {
  windowMs: 60000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later",
};
```

## Webhook Handling

### Incoming Webhooks

- Verify signatures using HMAC
- Queue for processing (don't block)
- Retry on failure with exponential backoff
- Max 5 retry attempts

### Webhook Response

```json
{
  "received": true,
  "webhookId": "uuid",
  "processingStatus": "queued|processing|complete|failed"
}
```

## Idempotency Keys

```typescript
// Include in request headers
Idempotency-Key: {uuid}

// Check if operation already performed
// Return cached result if duplicate
```

## Logging & Monitoring

### Log Levels

- `ERROR`: Service failures, critical issues
- `WARN`: Retries, degraded performance
- `INFO`: API calls, successful operations
- `DEBUG`: Detailed execution flow

### Metrics to Track

- Request rate per endpoint
- Error rate by error code
- Response time (p50, p95, p99)
- Circuit breaker state
- Retry attempts

## Backward Compatibility

### API Changes

- **Non-breaking**: Add optional fields, new endpoints
- **Breaking**: Version bump, maintain old version for 6 months
- **Deprecation**: Add deprecation warnings, document sunset date

### Database Migrations

- Never remove columns (add only)
- Use views for backward compatibility
- Document breaking changes

## Environment Variables

```bash
# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_KEY=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# Gemini AI
GEMINI_API_KEY=
API_KEY=

# IFlow
IFLOW_API_KEY=

# App
NODE_ENV=
API_VERSION=v1
```

## Integration Testing

### Test Coverage

- Unit tests for API clients
- Integration tests with mock services
- End-to-end tests with staging env
- Load testing for rate limits
- Chaos testing for resilience

### Test Data

- Use fixtures for consistent testing
- Test edge cases (timeouts, errors)
- Validate schema compliance
