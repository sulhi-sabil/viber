# Viber Integration Layer

A robust, production-ready TypeScript/JavaScript integration layer with built-in resilience patterns, error handling, and monitoring capabilities for external API integrations.

## Features

- **Resilience Patterns**: Built-in circuit breaker, retry logic with exponential backoff, and timeout handling
- **Error Handling**: Standardized error types with request tracking and developer-friendly messages
- **Logging**: Structured logging with sensitive data sanitization
- **Service Management**: Centralized service factory for dependency injection and lifecycle management
- **Type Safety**: Full TypeScript support with type-safe API clients
- **Extensible**: Easy to add new services with consistent patterns

## Quick Start

### Installation

```bash
npm install viber-integration-layer
```

### Basic Usage

```typescript
import {
  ServiceFactory,
  SupabaseService,
  GeminiService,
} from "viber-integration-layer";

// Initialize service factory
const factory = ServiceFactory.getInstance();

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
// Reset specific service
serviceFactory.resetCircuitBreaker("supabase");

// Reset all
serviceFactory.resetAllCircuitBreakers();
```

## API Reference

### ServiceFactory

```typescript
class ServiceFactory {
  static getInstance(
    circuitBreakerConfigs?: CircuitBreakerConfigMap,
  ): ServiceFactory;
  createSupabaseClient(config: SupabaseConfig): SupabaseService;
  createGeminiClient(config: GeminiConfig): GeminiService;
  getCircuitBreaker(serviceName: string): CircuitBreaker;
  resetCircuitBreaker(serviceName: string): void;
  resetAllCircuitBreakers(): void;
  getCircuitBreakerState(serviceName: string): CircuitBreakerState;
  getAllCircuitBreakerStates(): Record<string, CircuitBreakerState>;
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

## Best Practices

1. **Use ServiceFactory**: Always create services through the factory for consistent configuration
2. **Configure Timeouts**: Set appropriate timeouts for your use case
3. **Monitor Circuit Breakers**: Track circuit breaker states in production
4. **Handle Errors**: Always catch and handle errors appropriately
5. **Type Safety**: Use TypeScript for full type safety

## License

MIT
