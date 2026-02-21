/* global jest */

/**
 * Test Utilities Module
 *
 * This module provides reusable mock factories, test data builders,
 * and common test utilities to reduce duplication across test files.
 *
 * @module testing
 */

import type { SupabaseConfig } from "../services/supabase";
import type { GeminiConfig } from "../services/gemini";



/**
 * Creates a mock Supabase query chain for testing
 */
export function createMockSupabaseQueryChain(
  result: { data: unknown; error: unknown } = { data: null, error: null },
): Record<string, jest.Mock> {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };

  chain.select.mockImplementation(() => chain);
  chain.insert.mockImplementation(() => chain);
  chain.update.mockImplementation(() => chain);
  chain.delete.mockImplementation(() => chain);
  chain.upsert.mockImplementation(() => chain);

  return chain;
}

/**
 * Creates a mock Supabase client with standard CRUD methods
 */
export function createMockSupabaseClient(): {
  from: jest.Mock;
  rpc: jest.Mock;
} {
  const queryChain = createMockSupabaseQueryChain();

  return {
    from: jest.fn().mockReturnValue(queryChain),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
}

/**
 * Creates a mock Supabase admin client
 */
export function createMockSupabaseAdminClient(): {
  from: jest.Mock;
} {
  const queryChain = createMockSupabaseQueryChain();

  return {
    from: jest.fn().mockReturnValue(queryChain),
  };
}

/**
 * Creates a mock Gemini API response
 */
export function createMockGeminiResponse(options: {
  text?: string;
  finishReason?: string;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}): {
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
} {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: options.text ?? "Mock response" }],
        },
        finishReason: options.finishReason ?? "STOP",
      },
    ],
    usageMetadata: options.usageMetadata ?? {
      promptTokenCount: 10,
      candidatesTokenCount: 5,
      totalTokenCount: 15,
    },
  };
}

/**
 * Creates a mock fetch response for Gemini API
 */
export function createMockFetchResponse(
  options:
    | { ok: true; data: unknown }
    | { ok: false; status: number; error?: { message: string; code?: number } },
): {
  ok: boolean;
  status: number;
  json: jest.Mock;
  headers: { get: jest.Mock };
  body?: ReadableStream;
} {
  if (options.ok) {
    return {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(options.data),
      headers: { get: jest.fn().mockReturnValue(null) },
    };
  }

  return {
    ok: false,
    status: options.status,
    json: jest.fn().mockResolvedValue({
      error: options.error ?? { message: "Error", code: options.status },
    }),
    headers: {
      get: jest
        .fn()
        .mockImplementation((name: string) =>
          name === "Retry-After" ? "60" : null,
        ),
    },
  };
}

/**
 * Creates a mock ReadableStream for streaming responses
 */
export function createMockReadableStream(chunks: string[]): ReadableStream {
  const encoder = new TextEncoder();
  const data = chunks.map((chunk) => `data: ${chunk}\n\n`).join("");

  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
}

/**
 * Default test configuration for SupabaseService
 */
export function createTestSupabaseConfig(
  overrides: Partial<SupabaseConfig> = {},
): SupabaseConfig {
  return {
    url: "https://test.supabase.co",
    anonKey: "test-anon-key",
    serviceRoleKey: "test-service-role-key",
    timeout: 10000,
    maxRetries: 3,
    circuitBreakerThreshold: 5,
    circuitBreakerResetTimeout: 60000,
    ...overrides,
  };
}

/**
 * Default test configuration for GeminiService
 */
export function createTestGeminiConfig(
  overrides: Partial<GeminiConfig> = {},
): GeminiConfig {
  return {
    apiKey: "test-api-key-12345678",
    timeout: 30000,
    maxRetries: 3,
    circuitBreakerThreshold: 5,
    circuitBreakerResetTimeout: 60000,
    rateLimitRequests: 15,
    rateLimitWindow: 60000,
    ...overrides,
  };
}

/**
 * Creates a test database row with sensible defaults
 */
export function createTestRow<T extends Record<string, unknown>>(
  overrides: Partial<T> = {},
): T & { id: string; created_at: string; updated_at: string } {
  const now = new Date().toISOString();
  return {
    id: `test-${Date.now()}`,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as T & { id: string; created_at: string; updated_at: string };
}

/**
 * Creates multiple test rows
 */
export function createTestRows<T extends Record<string, unknown>>(
  count: number,
  baseData: Partial<T> = {},
): Array<T & { id: string; created_at: string; updated_at: string }> {
  return Array.from({ length: count }, (_, index) =>
    createTestRow<T>({
      ...baseData,
      id: `test-${Date.now()}-${index}`,
    }),
  );
}

/**
 * Common test user row
 */
export function createTestUser(
  overrides: Partial<{
    name: string;
    email: string;
    age: number;
  }> = {},
): {
  id: string;
  name: string;
  email: string;
  age: number;
  created_at: string;
  updated_at: string;
} {
  return createTestRow({
    name: "Test User",
    email: "test@example.com",
    age: 30,
    ...overrides,
  });
}

/**
 * Creates a mock PostgrestError
 */
export function createPostgrestError(options: {
  message: string;
  code: string;
  details?: string;
  hint?: string;
}): {
  message: string;
  code: string;
  details: string | null;
  hint: string | null;
} {
  return {
    message: options.message,
    code: options.code,
    details: options.details ?? null,
    hint: options.hint ?? null,
  };
}

/**
 * Common Postgrest error templates
 */
export const PostgrestErrors = {
  notFound: () =>
    createPostgrestError({
      message: "Not found",
      code: "PGRST116",
    }),
  duplicateKey: () =>
    createPostgrestError({
      message: "Unique violation",
      code: "23505",
      details: "Duplicate key",
    }),
  tableNotFound: () =>
    createPostgrestError({
      message: "Relation does not exist",
      code: "42P01",
      details: "Table not found",
    }),
  connectionFailed: () =>
    createPostgrestError({
      message: "Connection failed",
      code: "08006",
    }),
};

/**
 * Waits for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  });
}

/**
 * Creates a mock function that resolves after specified delay
 */
export function createDelayedMock<T>(value: T, delayMs: number): jest.Mock {
  return jest.fn().mockImplementation(
    () =>
      new Promise<T>((resolve) => {
        const timer = setTimeout(() => resolve(value), delayMs);
        if (typeof timer.unref === "function") {
          timer.unref();
        }
      }),
  );
}

/**
 * Setup helper for Supabase module mock
 * Use this in your test file's mock setup
 */
export function getSupabaseModuleMock(
  mockClient: ReturnType<typeof createMockSupabaseClient>,
  mockAdminClient?: ReturnType<typeof createMockSupabaseAdminClient>,
): (url: string, key: string) => unknown {
  return (_url: string, key: string) => {
    if (key === "test-service-role-key" && mockAdminClient) {
      return mockAdminClient;
    }
    return mockClient;
  };
}

export type { SupabaseConfig, GeminiConfig };
