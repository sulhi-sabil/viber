# Viber Integration Layer

A robust, production-ready TypeScript/JavaScript integration layer with built-in resilience patterns, error handling, and monitoring capabilities for external API integrations.

## Features

- **Resilience Patterns**: Built-in circuit breaker, retry logic with exponential backoff, and timeout handling
- **Error Handling**: Standardized error types with request tracking and developer-friendly messages
- **Logging**: Structured logging with sensitive data sanitization
- **Service Management**: Centralized service factory for dependency injection and lifecycle management
- **Input Validation**: Comprehensive validator utility for type checking, format validation, and sanitization
- **Rate Limiting**: Built-in rate limiter with sliding window algorithm for API quota compliance
- **Idempotency**: Idempotency manager for safe operation handling with UUID validation
- **Type Safety**: Full TypeScript support with type-safe API clients
- **Extensible**: Easy to add new services with consistent patterns
- **Automated Maintenance**: Dependabot configuration for automated dependency updates
- **CI/CD Ready**: GitHub Actions workflows for continuous integration

## Quick Start

### Installation

```bash
npm install viber-integration-layer
```

### Basic Usage

```typescript
import {
  serviceFactory,
  SupabaseService,
  GeminiService,
} from "viber-integration-layer";

// Use pre-configured service factory singleton
// Or create your own: const factory = ServiceFactory.getInstance();

// Create Supabase client
const supabase = factory.createSupabaseClient({
  url: "https://your-project.supabase.co",
  anonKey: "your-anon-key",
  serviceRoleKey: "your-service-role-key", // optional
});

// Create Gemini client
const gemini = factory.createGeminiClient({
  apiKey: "your-gemini-api-key",
});

// Use services
const users = await supabase.select("users");
const text = await gemini.generateText("Hello, world!");
```

## Architecture

The integration layer follows clean architecture principles with clear separation of concerns:

### Service Factory Pattern

The `ServiceFactory` provides centralized service initialization and management:

- **Dependency Injection**: Services accept CircuitBreaker instances instead of creating them
- **Singleton Management**: Ensures single instance per service configuration
- **Lifecycle Control**: Easy reset and management of service instances
- **Configuration Centralization**: CircuitBreaker configs managed centrally

A pre-configured `serviceFactory` singleton is exported for convenience:

```typescript
import { serviceFactory } from "viber-integration-layer";

// Directly create services without manual factory initialization
const supabase = serviceFactory.createSupabaseClient({ url, anonKey });
const gemini = serviceFactory.createGeminiClient({ apiKey });
```

### Layer Structure

```
src/
├── services/          # External API clients (Supabase, Gemini)
├── utils/            # Reusable utilities (Circuit Breaker, Retry, Logger)
├── types/            # TypeScript type definitions
└── index.ts          # Public API exports
```

## Services

### Supabase Service

Full-featured Supabase client with resilience patterns:

```typescript
import { ServiceFactory } from "viber-integration-layer";

const factory = ServiceFactory.getInstance();
const supabase = factory.createSupabaseClient({
  url: "https://your-project.supabase.co",
  anonKey: "your-anon-key",
  timeout: 10000,
  maxRetries: 3,
});

// CRUD operations
const user = await supabase.selectById("users", "user-123");
await supabase.insert("users", { email: "user@example.com" });
await supabase.update("users", "user-123", { email: "new@example.com" });
await supabase.delete("users", "user-123");

// Health check
const health = await supabase.healthCheck();
```

### Gemini Service

Google Gemini AI client with rate limiting and streaming support:

```typescript
import { ServiceFactory } from "viber-integration-layer";

const factory = ServiceFactory.getInstance();
const gemini = factory.createGeminiClient({
  apiKey: "your-api-key",
  timeout: 30000,
  maxRetries: 3,
  rateLimitRequests: 15,
  rateLimitWindow: 60000,
});

// Generate text
const text = await gemini.generateText("Explain quantum computing");

// Generate content with options
const response = await gemini.generateContent(
  [{ role: "user", parts: [{ text: "Hello" }] }],
  { temperature: 0.7, maxOutputTokens: 1024 },
);

// Streaming response
await gemini.generateTextStream("Tell me a story", (chunk) =>
  console.log(chunk.text),
);
```

## Resilience Patterns

### Circuit Breaker

Prevents cascading failures by stopping calls to failing services:

```typescript
import { CircuitBreaker, CircuitState } from "viber-integration-layer";

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000,
  onStateChange: (state, reason) => {
    console.log(`Circuit breaker ${state}: ${reason}`);
  },
});

try {
  const result = await breaker.execute(async () => {
    return await riskyOperation();
  });
} catch (error) {
  console.error("Operation failed:", error);
}

// Check state
console.log(breaker.getState()); // CLOSED, OPEN, or HALF_OPEN
```

### Retry Logic

Automatic retry with exponential backoff:

```typescript
import { retry } from "viber-integration-layer";

const result = await retry(
  async () => {
    return await fetch("/api/data");
  },
  {
    maxAttempts: 3,
    retryableErrors: [408, 429, 500, 502, 503, 504],
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt}: ${error.message}`);
    },
  },
);
```

### Combined Resilience

Use the `executeWithResilience` utility for comprehensive resilience:

```typescript
import { executeWithResilience } from "viber-integration-layer";

const result = await executeWithResilience({
  operation: async () => {
    return await externalApiCall();
  },
  options: {
    timeout: 10000,
    useCircuitBreaker: true,
    useRetry: true,
  },
  circuitBreaker: myCircuitBreaker,
  maxRetries: 3,
  defaultTimeout: 10000,
  timeoutOperationName: "External API call",
});
```

## Utilities

### Logger

Structured logging utility with automatic sensitive data sanitization and configurable log levels.

```typescript
import { logger, ConsoleLogger } from "viber-integration-layer";

// Use singleton logger instance
logger.debug("Debug message", { userId: "123" });
logger.info("User logged in", { email: "user@example.com" });
logger.warn("Slow query detected", { queryDuration: 5000 });
logger.error("Database connection failed", { error: "Connection refused" });

// Sensitive data automatically redacted
logger.error("Auth failed", {
  password: "secret123",
  apiKey: "sk-123456",
  email: "user@example.com",
});
// Output: [ERROR] Auth failed {
//   password: "[REDACTED]",
//   apiKey: "[REDACTED]",
//   email: "user@example.com"
// }

// Configure log level
logger.setLevel("debug"); // Only logs debug and above
logger.setLevel("error"); // Only logs errors

// Create custom logger instance
const customLogger = new ConsoleLogger("warn");
customLogger.warn("Custom warning");
```

### Validator

Comprehensive input validation and sanitization utility for ensuring data integrity.

```typescript
import {
  Validator,
  SchemaValidator,
  createValidator,
} from "viber-integration-layer";

// Type validation
Validator.required(value, "username");
Validator.string(value, "name");
Validator.number(value, "age");
Validator.integer(value, "count");
Validator.boolean(value, "active");
Validator.array(value, "items");

// Format validation
Validator.email("user@example.com");
Validator.url("https://example.com");
Validator.uuid("550e8400-e29b-41d4-a716-446655440000");

// Length validation
Validator.minLength(value, 8, "password");
Validator.maxLength(value, 255, "title");

// Range validation
Validator.min(value, 18, "age");
Validator.max(value, 100, "score");

// Pattern validation
Validator.pattern(value, /^[A-Z][a-z]+$/, "name");

// Enum validation
Validator.enum(role, ["admin", "editor", "user"], "role");

// Sanitization
Validator.sanitize(value, { trim: true, escapeHtml: true });
Validator.sanitizeObject(data, {
  username: { trim: true, lowercase: true },
  email: { trim: true },
});

// Schema validation for complex objects
const userSchema = createValidator();
userSchema
  .addField("name")
  .addField("email")
  .addField("age", Validator.integer)
  .addField("active", Validator.boolean);

const userData = userSchema.validate({
  name: "John",
  email: "john@example.com",
  age: 30,
  active: true,
});

// Partial validation (returns errors without throwing)
const result = userSchema.validatePartial({ name: "Jane" });
// { valid: true, errors: [] }
```

### RateLimiter

Enforces request rate limits to prevent API abuse and ensure compliance with service quotas.

```typescript
import { RateLimiter, createRateLimiter } from "viber-integration-layer";

// Create rate limiter
const limiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  serviceName: "MyAPI",
});

// Using factory function
const limiter2 = createRateLimiter({
  maxRequests: 15,
  windowMs: 60000,
  serviceName: "GeminiAPI",
});

// Check rate limit (waits if limit reached)
await limiter.checkRateLimit();

// Get remaining requests
const remaining = limiter.getRemainingRequests();

// Get detailed metrics
const metrics = limiter.getMetrics();
// {
//   totalRequests: 10,
//   activeRequests: 10,
//   remainingRequests: 90,
//   windowStart: 1640000000000,
//   windowEnd: 1640000600000
// }

// Reset rate limiter
limiter.reset();
```

### IdempotencyManager

Ensures safe operation handling by preventing duplicate executions and returning cached responses for repeat requests.

```typescript
import {
  IdempotencyManager,
  createIdempotencyManager,
} from "viber-integration-layer";

// Create idempotency manager with default TTL (24h)
const manager = createIdempotencyManager();

// Create with custom TTL (1 hour)
const managerWithCustomTTL = createIdempotencyManager({
  ttlMs: 60 * 60 * 1000,
});

// Execute operation with idempotency key
const result = await manager.execute(
  "550e8400-e29b-41d4-a716-446655440000",
  async () => {
    // Your operation here (e.g., payment, user creation)
    return await createUser({ email: "user@example.com" });
  },
);

console.log(result.data); // Operation result
console.log(result.cached); // false (first execution)
console.log(result.idempotencyKey); // "550e8400-e29b-41d4-a716-446655440000"

// Repeat request with same key - returns cached result
const duplicateResult = await manager.execute(
  "550e8400-e29b-41d4-a716-446655440000",
  async () => {
    // This won't execute - cached result returned instead
    return await createUser({ email: "user@example.com" });
  },
);

console.log(duplicateResult.cached); // true (cached from previous request)
console.log(duplicateResult.data === result.data); // true

// Invalidate cached response when needed
await manager.invalidate("550e8400-e29b-41d4-a716-446655440000");

// Clear all cached responses
await manager.clear();
```

#### Custom Storage Backend

Use a custom storage backend (Redis, database, etc.) for distributed scenarios:

```typescript
import {
  IdempotencyManager,
  type IdempotencyStore,
} from "viber-integration-layer";

// Implement custom storage backend
class RedisStore implements IdempotencyStore {
  constructor(private redis: RedisClient) {}

  async get<T>(key: string): Promise<StoredResponse<T> | null> {
    const data = await this.redis.get(`idempotency:${key}`);
    return data ? JSON.parse(data) : null;
  }

  async set<T>(
    key: string,
    value: StoredResponse<T>,
    ttl: number,
  ): Promise<void> {
    await this.redis.setex(
      `idempotency:${key}`,
      Math.floor(ttl / 1000),
      JSON.stringify(value),
    );
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`idempotency:${key}`);
  }

  async clear(): Promise<void> {
    const keys = await this.redis.keys("idempotency:*");
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Use custom storage
const manager = createIdempotencyManager({
  store: new RedisStore(redisClient),
});
```

## Configuration

### Service Factory Configuration

Configure circuit breakers centrally:

```typescript
import { ServiceFactory } from "viber-integration-layer";

const factory = ServiceFactory.getInstance({
  supabase: {
    failureThreshold: 5,
    resetTimeout: 60000,
  },
  gemini: {
    failureThreshold: 3,
    resetTimeout: 30000,
  },
});
```

### Logging Configuration

Configure logging levels:

```typescript
import { logger } from "viber-integration-layer";

logger.setLevel("debug"); // 'error', 'warn', 'info', 'debug'
```

## Error Handling

All services throw standardized error types:

```typescript
import {
  SupabaseError,
  GeminiError,
  RateLimitError,
  TimeoutError,
  InternalError,
} from "viber-integration-layer";

try {
  await operation();
} catch (error) {
  if (error instanceof SupabaseError) {
    console.error("Supabase error:", error.code, error.message);
  } else if (error instanceof RateLimitError) {
    console.error("Rate limited, retry after:", error.retryAfter);
  } else {
    console.error("Unknown error:", error);
  }
}
```

## Monitoring

### Circuit Breaker States

Monitor circuit breaker states across all services:

```typescript
import { serviceFactory } from "viber-integration-layer";

const states = serviceFactory.getAllCircuitBreakerStates();
console.log(states);
// {
//   supabase: { state: 'CLOSED', metrics: { ... } },
//   gemini: { state: 'OPEN', metrics: { ... } }
// }
```

### Reset Circuit Breakers

```typescript
// Reset specific service circuit breaker
serviceFactory.resetCircuitBreaker("supabase");

// Reset all circuit breakers
serviceFactory.resetAllCircuitBreakers();
```

### Reset Services

```typescript
// Reset specific service instance (clears from cache)
serviceFactory.resetService("supabase-https://project.supabase.co");

// Reset all service instances (clears entire cache)
serviceFactory.resetAllServices();

// Reset entire factory instance (including circuit breakers)
ServiceFactory.resetInstance();
```

## API Reference

### ServiceFactory

```typescript
class ServiceFactory {
  static getInstance(
    circuitBreakerConfigs?: CircuitBreakerConfigMap,
  ): ServiceFactory;
  static resetInstance(): void;
  createSupabaseClient(config: SupabaseConfig): SupabaseService;
  createGeminiClient(config: GeminiConfig): GeminiService;
  getCircuitBreaker(serviceName: string): CircuitBreaker;
  resetCircuitBreaker(serviceName: string): void;
  resetAllCircuitBreakers(): void;
  getService(serviceName: string): unknown;
  resetService(serviceName: string): void;
  resetAllServices(): void;
  getCircuitBreakerState(serviceName: string): CircuitBreakerState;
  getAllCircuitBreakerStates(): Record<string, CircuitBreakerState>;
}

export const serviceFactory: ServiceFactory;
```

### Logger

```typescript
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

class ConsoleLogger implements Logger {
  constructor(level?: "debug" | "info" | "warn" | "error");
  setLevel(level: "debug" | "info" | "warn" | "error"): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const logger: Logger;
```

### Validator

```typescript
class Validator {
  static required(value: unknown, fieldName?: string): void;
  static string(value: unknown, fieldName?: string): void;
  static number(value: unknown, fieldName?: string): void;
  static integer(value: unknown, fieldName?: string): void;
  static boolean(value: unknown, fieldName?: string): void;
  static array(value: unknown, fieldName?: string): void;
  static email(value: unknown, fieldName?: string): void;
  static url(value: unknown, fieldName?: string): void;
  static uuid(value: unknown, fieldName?: string): void;
  static minLength(value: unknown, min: number, fieldName?: string): void;
  static maxLength(value: unknown, max: number, fieldName?: string): void;
  static min(value: unknown, min: number, fieldName?: string): void;
  static max(value: unknown, max: number, fieldName?: string): void;
  static enum<T extends string>(
    value: unknown,
    allowedValues: readonly T[],
    fieldName?: string,
  ): void;
  static pattern(value: unknown, regex: RegExp, fieldName?: string): void;
  static sanitize(value: unknown, options?: SanitizeOptions): unknown;
  static sanitizeObject(
    obj: Record<string, unknown>,
    fieldSanitizers: Record<string, SanitizeOptions>,
  ): Record<string, unknown>;
}

class SchemaValidator<T extends Record<string, unknown>> {
  addField<K extends keyof T>(
    field: K,
    ...rules: ValidationRule[]
  ): SchemaValidator<T>;
  validate(data: Partial<T>): T;
  validatePartial(data: Partial<T>): ValidationResult;
}

function createValidator(): SchemaValidator<Record<string, unknown>>;

// Utility functions
function validateEmail(email: unknown): boolean;
function validateUrl(url: unknown): boolean;
function validateUuid(uuid: unknown): boolean;
function sanitizeInput(input: unknown, escapeHtml?: boolean): unknown;
```

### RateLimiter

```typescript
class RateLimiter {
  constructor(options?: RateLimiterOptions);
  checkRateLimit(): Promise<void>;
  getRemainingRequests(): number;
  getMetrics(): RateLimiterMetrics;
  reset(): void;
}

function createRateLimiter(options?: RateLimiterOptions): RateLimiter;
```

### IdempotencyManager

```typescript
class IdempotencyManager {
  constructor(options?: IdempotencyManagerOptions);
  execute<T>(
    idempotencyKey: string,
    operation: () => Promise<T>,
  ): Promise<IdempotencyResult<T>>;
  invalidate(idempotencyKey: string): Promise<void>;
  clear(): Promise<void>;
}

function createIdempotencyManager(
  options?: IdempotencyManagerOptions,
): IdempotencyManager;

interface IdempotencyManagerOptions {
  ttlMs?: number; // Default: 24 hours
  store?: IdempotencyStore; // Default: InMemoryIdempotencyStore
}

interface IdempotencyResult<T> {
  data: T;
  cached: boolean;
  idempotencyKey: string;
  timestamp: number;
}

interface IdempotencyStore {
  get<T>(key: string): Promise<StoredResponse<T> | null>;
  set<T>(key: string, value: StoredResponse<T>, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface StoredResponse<T> {
  data: T;
  timestamp: number;
}
```

## Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## Vercel Deployment

This library includes serverless function wrappers for deployment on Vercel. The API endpoints expose the library's services (Supabase, Gemini) as HTTP endpoints.

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check for all configured services |
| `/api/ai/generate` | POST | Generate text using Gemini AI |
| `/api/status` | GET | Circuit breaker and rate limiter status |
| `/api/metrics` | GET | Prometheus metrics for monitoring |

### Environment Variables

Set these environment variables in your Vercel project:

```bash
# Supabase (optional)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # optional

# Gemini (required for /api/ai/generate)
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-flash  # optional, default shown

# Optional: Override defaults
SUPABASE_TIMEOUT=10000
SUPABASE_MAX_RETRIES=3
GEMINI_TIMEOUT=30000
GEMINI_MAX_RETRIES=3
GEMINI_RATE_LIMIT_REQUESTS=15
GEMINI_RATE_LIMIT_WINDOW=60000
```

### Deploy to Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Link and deploy:
   ```bash
   vercel link
   vercel deploy
   ```

3. Set environment variables in Vercel dashboard or via CLI:
   ```bash
   vercel env add GEMINI_API_KEY
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_ANON_KEY
   ```

### API Examples

#### Health Check

```bash
curl https://your-app.vercel.app/api/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "supabase": { "status": "healthy" },
      "gemini": { "status": "healthy" }
    },
    "configured": { "supabase": true, "gemini": true },
    "timestamp": "2026-02-21T20:00:00.000Z"
  }
}
```

#### AI Text Generation

```bash
curl -X POST https://your-app.vercel.app/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain quantum computing"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "prompt": "Explain quantum computing",
    "text": "Quantum computing uses quantum bits...",
    "model": "gemini-1.5-flash"
  }
}
```

#### Status Endpoint

```bash
curl https://your-app.vercel.app/api/status
```

Response:
```json
{
  "success": true,
  "data": {
    "circuitBreakers": {
      "supabase": { "state": "CLOSED", "metrics": { "failureCount": 0 } },
      "gemini": { "state": "CLOSED", "metrics": { "failureCount": 0 } }
    },
    "rateLimiters": {
      "gemini": { "remainingRequests": 14, "maxRequests": 15, "windowMs": 60000 }
    },
    "timestamp": "2026-02-21T20:00:00.000Z"
  }
}
```

#### Metrics Endpoint (Prometheus)

```bash
curl https://your-app.vercel.app/api/metrics
```

Response (Prometheus text format):
```
# HELP requests_total Total number of requests
# TYPE requests_total counter
requests_total{service="gemini"} 100
# HELP errors_total Total number of errors
# TYPE errors_total counter
errors_total{service="gemini"} 5
# HELP request_duration_seconds Request duration in seconds
# TYPE request_duration_seconds histogram
request_duration_seconds_bucket{service="gemini",le="0.1"} 50
...
```

**Authentication**: Optionally protect the endpoint with a bearer token:
```bash
# Set environment variable
METRICS_BEARER_TOKEN=your-secure-token

# Access with token
curl -H "Authorization: Bearer your-secure-token" https://your-app.vercel.app/api/metrics
```

### Vercel Configuration

The `vercel.json` file is pre-configured with:

- **Fluid Compute**: Enabled for optimal cold start performance
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, etc.
- **Function Configuration**: 1024MB memory, 30s max duration
- **No caching**: API routes configured with `no-store`

## Best Practices

1. **Use ServiceFactory**: Always create services through the factory for consistent configuration
2. **Configure Timeouts**: Set appropriate timeouts for your use case
3. **Monitor Circuit Breakers**: Track circuit breaker states in production
4. **Handle Errors**: Always catch and handle errors appropriately
5. **Type Safety**: Use TypeScript for full type safety

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details on how to:

- Set up your development environment
- Submit bug reports and feature requests
- Submit pull requests
- Follow our coding standards

## Security

For security-related information, please see our [Security Policy](./SECURITY.md) for:

- Supported versions
- How to report vulnerabilities
- Security best practices
- Response timelines

## License

MIT
