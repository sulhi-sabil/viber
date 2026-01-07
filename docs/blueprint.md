# Integration Layer Blueprint

Version: 2.0
Project: Viber Integration Layer
Last Updated: 2026-01-07

## Executive Summary

The Viber Integration Layer is a production-ready TypeScript/JavaScript library that provides robust, scalable, and maintainable integration with external APIs. It implements enterprise-grade resilience patterns, error handling, and monitoring capabilities.

### Goals

- **Reliability**: Minimize failures through circuit breakers, retries, and timeouts
- **Observability**: Structured logging and circuit breaker state monitoring
- **Maintainability**: Clean architecture with clear separation of concerns
- **Testability**: Dependency injection and mock support for isolated testing
- **Extensibility**: Easy to add new services with consistent patterns

## System Architecture

### Layer Structure

The integration layer follows a clean, layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
│                  (Your Business Logic)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   Services Layer                           │
│          (External API Client Implementations)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Supabase     │  │ Gemini       │  │ Future       │ │
│  │ Service      │  │ Service      │  │ Services     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   Utilities Layer                          │
│         (Reusable Cross-Cutting Concerns)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Circuit      │  │ Retry        │  │ Logger       │ │
│  │ Breaker     │  │ Logic        │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │ Service      │  │ Resilience   │                     │
│  │ Factory      │  │ Executor     │                     │
│  └──────────────┘  └──────────────┘                     │
└──────────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    Types Layer                           │
│              (TypeScript Definitions)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Error Types  │  │ Database     │  │ Service      │ │
│  │              │  │ Types        │  │ Configs      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Dependency Flow

Dependencies flow inward following the Dependency Inversion Principle:

- **Application Layer** → Depends on **Services Layer** interfaces
- **Services Layer** → Depends on **Utilities Layer** abstractions
- **Utilities Layer** → Independent, no dependencies on upper layers

### Key Patterns

1. **Service Factory Pattern**: Centralized service creation and lifecycle management
2. **Dependency Injection**: Services accept dependencies via constructor
3. **Singleton Pattern**: Single ServiceFactory instance for consistency
4. **Circuit Breaker Pattern**: Prevents cascading failures
5. **Retry Pattern**: Automatic retry with exponential backoff
6. **Strategy Pattern**: Pluggable error handling and retry strategies

## Component Descriptions

### ServiceFactory

**Purpose**: Centralized factory for creating and managing service instances with dependency injection.

**Responsibilities**:

- Create and cache service instances
- Configure CircuitBreaker instances per service
- Provide circuit breaker state monitoring
- Manage service lifecycle (create, reset, get)

**Key Methods**:

- `createSupabaseClient(config)`: Create Supabase service instance
- `createGeminiClient(config)`: Create Gemini service instance
- `getCircuitBreaker(serviceName)`: Get circuit breaker for a service
- `resetCircuitBreaker(serviceName)`: Reset specific circuit breaker
- `getAllCircuitBreakerStates()`: Get all circuit breaker states

### Services Layer

#### SupabaseService

**Purpose**: Robust Supabase database client with resilience patterns.

**Features**:

- CRUD operations (select, insert, update, delete, upsert)
- Query building with filters, ordering, pagination
- Circuit breaker integration
- Retry logic with exponential backoff
- Health check with latency measurement
- Admin client support

#### GeminiService

**Purpose**: Google Gemini AI client with rate limiting and streaming support.

**Features**:

- Text generation
- Content generation with model options
- Streaming responses
- Rate limiting (configurable)
- Token usage tracking
- Circuit breaker integration

### Utilities Layer

#### CircuitBreaker

**Purpose**: Prevents cascading failures by stopping calls to failing services.

**States**:

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Circuit open, requests rejected immediately
- **HALF_OPEN**: Testing if service has recovered

**Configuration**:

- `failureThreshold`: Failures before opening circuit
- `resetTimeout`: How long to stay in OPEN state
- `halfOpenMaxCalls\*\*: Max calls in HALF_OPEN state
- `monitorWindow`: Time window for metrics

#### Retry Logic

**Purpose**: Automatic retry with exponential backoff for transient failures.

**Features**:

- Configurable max attempts
- Exponential backoff (1s, 2s, 4s, ...)
- Retryable error codes (408, 429, 500-504)
- Retryable error types (operational errors)
- Retry callbacks for monitoring

#### Logger

**Purpose**: Structured logging with sensitive data sanitization.

**Features**:

- Log levels (ERROR, WARN, INFO, DEBUG)
- Sensitive data redaction
- Performance-optimized sanitization
- Configurable output level

#### Resilience Executor

**Purpose**: Unified execution combining timeout, circuit breaker, and retry.

**Flow**:

1. Wrap operation with timeout
2. Pass through circuit breaker if enabled
3. Apply retry logic if enabled
4. Return result or throw error

### Types Layer

#### Error Types

Standardized error hierarchy:

- `BaseError`: Base class for all errors
- `SupabaseError`: Supabase-specific errors
- `GeminiError`: Gemini-specific errors
- `RateLimitError`: Rate limit exceeded
- `TimeoutError`: Operation timed out
- `InternalError`: Internal system errors

Features:

- Request ID tracking
- Developer messages (safe to show users)
- Debug messages (internal only)
- Error severity levels
- Operational vs non-operational flag

## Data Flow

### Request Flow (Supabase Example)

```
Application
   │
   ├─> SupabaseService.select(table)
   │       │
   │       ├─> executeWithResilience()
   │       │       │
   │       │       ├─> Add timeout wrapper
   │       │       │
   │       │       ├─> CircuitBreaker.execute()
   │       │       │       │
   │       │       │       ├─> Check state (OPEN/CLOSED)
   │       │       │       │
   │       │       │       └─> Execute operation
   │       │       │
   │       │       └─> Retry (if error and retryable)
   │       │               │
   │       │               ├─> Wait with backoff
   │       │               │
   │       │               └─> Try again
   │       │
   │       └─> Return result or throw error
   │
   └─< Return data or error
```

### Circuit Breaker State Transitions

```
         +-------------+
         |   CLOSED    |
         +-------------+
               │
               │ failures >= threshold
               ▼
         +-------------+
         |    OPEN     | ──┐
         +-------------+   │ after resetTimeout
               │         │
               │         │
               │ test    │
               ▼         │
         +-------------+   │
         |  HALF_OPEN  |───┘
         +-------------+
         │
         │ success
         ▼
    [reset failures]
         │
         └─> CLOSED
         │
         │ failure
         ▼
    [go to OPEN]
```

## Configuration

### Service Factory Configuration

```typescript
interface CircuitBreakerConfigMap {
  supabase?: {
    failureThreshold?: number;
    resetTimeout?: number;
    halfOpenMaxCalls?: number;
    monitorWindow?: number;
  };
  gemini?: {
    failureThreshold?: number;
    resetTimeout?: number;
    halfOpenMaxCalls?: number;
    monitorWindow?: number;
  };
}
```

### Default Configuration

```typescript
const DEFAULT_CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenMaxCalls: 3,
  monitorWindow: 60000, // 1 minute
};
```

### Retry Configuration

```typescript
interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  retryableErrors: number[]; // HTTP status codes
  retryableErrorCodes: string[]; // Custom error codes
}
```

## Error Handling Strategy

### Error Categories

1. **Transient Errors**: Temporary failures, safe to retry
   - Network timeouts (408)
   - Rate limits (429)
   - Server errors (500, 502, 503, 504)

2. **Non-Transient Errors**: Permanent failures, don't retry
   - Bad requests (400)
   - Unauthorized (401)
   - Forbidden (403)
   - Not found (404)

3. **Operational vs Non-Operational**:
   - **Operational**: Expected errors, retry allowed
   - **Non-Operational**: Critical errors, no retry

### Error Response Format

```typescript
interface ErrorResponse {
  code: string; // Unique error code
  message: string; // User-friendly message
  details?: unknown; // Additional details
  requestId: string; // Request tracking
  severity: "low" | "medium" | "high" | "critical";
  timestamp: number; // ISO timestamp
}
```

## Monitoring & Observability

### Circuit Breaker Monitoring

Monitor these metrics for each service:

- Current state (CLOSED, OPEN, HALF_OPEN)
- Failure count in monitor window
- Success count in monitor window
- Last state change timestamp

### Service Health Checks

Each service provides health check:

- `SupabaseService.healthCheck()`: Test DB connection
- `GeminiService.healthCheck()`: Test API connectivity

Returns:

```typescript
{
  healthy: boolean;
  latency: number;
  error?: string;
}
```

### Logging

Structured logs with:

- Log level (ERROR, WARN, INFO, DEBUG)
- Timestamp
- Service name
- Operation type
- Request ID
- Error details (if applicable)

All sensitive data (passwords, tokens, keys) automatically redacted.

## Security Considerations

### Sensitive Data Protection

- Automatic redaction of:
  - Password fields
  - API keys
  - Auth tokens
  - Credit card numbers
  - Social security numbers

- Configurable via sensitive field patterns

### API Key Management

- Never log API keys
- Keys read from environment variables
- Support for separate anon and service role keys (Supabase)

## Performance Optimizations

### Logger Sanitization

- Pattern matching cache (1000 entry limit with auto-cleanup)
- Maximum depth limit (5 levels)
- Maximum key limit (100 keys)
- Array truncation (max 10 items)
- Performance: ~10,000x improvement (0.144ms for 500 iterations)

### Retry Logic

- Set-based error checking (O(1) vs O(n))
- Early termination when limits reached
- Efficient backoff calculation

### Circuit Breaker

- State machine with minimal overhead
- Lazy metrics calculation
- Efficient state transition logic

## Testing Strategy

### Unit Tests

- Test individual utilities in isolation
- Mock external dependencies
- Test success and failure scenarios
- Edge cases and boundary conditions

### Integration Tests

- Test service interactions with utilities
- Test retry + circuit breaker integration
- Test error handling pipeline
- Test configuration variations

### Test Coverage

Current coverage:

- **Statements**: 96.8%
- **Branches**: 85.85%
- **Functions**: 100%
- **Lines**: 97.19%

## Deployment Considerations

### Environment Configuration

Services should be configured via environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-key
```

### Circuit Breaker Tuning

Adjust thresholds based on:

- Service reliability
- SLA requirements
- Business impact of failures
- Retry costs (API pricing)

### Monitoring Alerts

Recommended alerts:

- Circuit breaker OPEN for > 5 minutes
- Error rate > 5%
- P95 latency > threshold
- Health check failures

## Extensibility

### Adding New Services

To add a new service:

1. Create service class in `src/services/`
2. Accept CircuitBreaker in constructor
3. Use `executeWithResilience` for resilience
4. Add factory method in `ServiceFactory`
5. Export from `src/index.ts`

Example:

```typescript
export class MyService {
  constructor(
    private config: MyConfig,
    circuitBreaker?: CircuitBreaker
  ) {
    this.circuitBreaker = circuitBreaker ?? new CircuitBreaker({...});
  }

  async doSomething() {
    return this.executeWithResilience(async () => {
      // Implementation
    });
  }
}
```

## Future Enhancements

### Planned Features

- [I03] Cloudflare API Client
- [I06] API Rate Limiter
- [I07] Webhook Handler
- [I09] Request Logging
- [I11] API Monitoring
- [I12] Idempotency Support

### Architectural Improvements

- Distributed tracing (OpenTelemetry)
- Metrics export (Prometheus)
- Dynamic configuration reload
- Service discovery integration

## Success Criteria

- ✅ Clean architecture with clear layer separation
- ✅ Dependencies flow correctly (inward)
- ✅ Services loosely coupled via interfaces
- ✅ High testability with dependency injection
- ✅ Consistent resilience patterns across services
- ✅ Comprehensive error handling
- ✅ Production-ready monitoring
- ✅ Extensible for new services
- ✅ Zero regressions in existing functionality
