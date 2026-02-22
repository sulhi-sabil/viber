/**
 * Cloudflare Worker Entry Point
 *
 * This is the main entry point for Cloudflare Workers deployment.
 * Uses Hono as a lightweight, modern router that works on edge runtimes.
 *
 * Routes mirror the Vercel API handlers for consistency:
 * - GET /api/health - Health check for all services
 * - GET /api/status - Circuit breaker and rate limiter status
 * - POST /api/ai/generate - Generate text using Gemini AI
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import {
  ServiceFactory,
  type SupabaseConfig,
  type GeminiConfig,
  type SupabaseService,
  type GeminiService,
  RateLimitError,
} from "./index";

// Type for Cloudflare Worker bindings
type Bindings = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_TIMEOUT?: string;
  SUPABASE_MAX_RETRIES?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_TIMEOUT?: string;
  GEMINI_MAX_RETRIES?: string;
  GEMINI_RATE_LIMIT_REQUESTS?: string;
  GEMINI_RATE_LIMIT_WINDOW?: string;
  ENVIRONMENT?: string;
};

// Create Hono app with typed bindings
const app = new Hono<{ Bindings: Bindings }>();

// Add middleware
app.use("*", honoLogger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Security headers middleware
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("X-XSS-Protection", "1; mode=block");
  c.res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
});

// Helper to get services from environment bindings
function getSupabase(env: Bindings): SupabaseService | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return null;
  }

  const factory = ServiceFactory.getInstance();
  const config: SupabaseConfig = {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    timeout: parseInt(env.SUPABASE_TIMEOUT || "10000", 10),
    maxRetries: parseInt(env.SUPABASE_MAX_RETRIES || "3", 10),
  };

  return factory.createSupabaseClient(config);
}

function getGemini(env: Bindings): GeminiService | null {
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  const factory = ServiceFactory.getInstance();
  const config: GeminiConfig = {
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL || "gemini-1.5-flash",
    timeout: parseInt(env.GEMINI_TIMEOUT || "30000", 10),
    maxRetries: parseInt(env.GEMINI_MAX_RETRIES || "3", 10),
    rateLimitRequests: parseInt(env.GEMINI_RATE_LIMIT_REQUESTS || "15", 10),
    rateLimitWindow: parseInt(env.GEMINI_RATE_LIMIT_WINDOW || "60000", 10),
  };

  return factory.createGeminiClient(config);
}

function getConfiguredServices(env: Bindings): {
  supabase: boolean;
  gemini: boolean;
} {
  return {
    supabase: !!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
    gemini: !!env.GEMINI_API_KEY,
  };
}

// API response helpers
function jsonResponse<T>(data: T, status = 200) {
  return Response.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

function errorResponse(
  code: string,
  message: string,
  status = 500,
  details?: unknown,
) {
  return Response.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

// Routes

/**
 * GET /api/health
 * Health check for all configured services
 */
app.get("/api/health", async (c) => {
  const env = c.env;
  const configured = getConfiguredServices(env);
  const healthResults: Record<string, unknown> = {};
  const timestamp = new Date().toISOString();

  const supabase = getSupabase(env);
  if (supabase) {
    try {
      const health = await supabase.healthCheck();
      healthResults.supabase = health;
    } catch (err) {
      healthResults.supabase = {
        status: "unhealthy",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  } else {
    healthResults.supabase = {
      status: "not_configured",
      message: "SUPABASE_URL and SUPABASE_ANON_KEY required",
    };
  }

  const gemini = getGemini(env);
  if (gemini) {
    try {
      const health = await gemini.healthCheck();
      healthResults.gemini = health;
    } catch (err) {
      healthResults.gemini = {
        status: "unhealthy",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  } else {
    healthResults.gemini = {
      status: "not_configured",
      message: "GEMINI_API_KEY required",
    };
  }

  const allHealthy = Object.values(healthResults).every(
    (r) => (r as { status?: string }).status === "healthy",
  );
  const anyConfigured = configured.supabase || configured.gemini;

  const status = !anyConfigured
    ? "not_configured"
    : allHealthy
      ? "healthy"
      : "degraded";

  return jsonResponse({
    status,
    services: healthResults,
    configured,
    timestamp,
  });
});

/**
 * GET /api/status
 * Circuit breaker and rate limiter status
 */
app.get("/api/status", (c) => {
  const env = c.env;
  const factory = ServiceFactory.getInstance();
  const circuitBreakerStates = factory.getAllCircuitBreakerStates();

  const rateLimiters: Record<string, unknown> = {};

  const gemini = getGemini(env);
  if (gemini) {
    try {
      const status = gemini.getRateLimiterStatus();
      rateLimiters.gemini = status;
    } catch {
      rateLimiters.gemini = null;
    }
  }

  return jsonResponse({
    circuitBreakers: circuitBreakerStates,
    rateLimiters,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/ai/generate
 * Generate text using Gemini AI
 */
app.post("/api/ai/generate", async (c) => {
  const env = c.env;

  const gemini = getGemini(env);
  if (!gemini) {
    return errorResponse("SERVICE_UNAVAILABLE", "GEMINI_API_KEY not configured", 503);
  }

  const contentType = c.req.header("Content-Type");
  if (!contentType?.includes("application/json")) {
    return errorResponse("BAD_REQUEST", "Content-Type must be application/json", 400);
  }

  let body: { prompt?: string; temperature?: number; maxOutputTokens?: number };
  try {
    body = await c.req.json();
  } catch {
    return errorResponse("BAD_REQUEST", "Invalid JSON body", 400);
  }

  if (!body.prompt || typeof body.prompt !== "string") {
    return errorResponse("BAD_REQUEST", "prompt is required and must be a string", 400);
  }

  if (body.prompt.length > 32000) {
    return errorResponse("BAD_REQUEST", "prompt must be less than 32000 characters", 400);
  }

  const { prompt, temperature, maxOutputTokens } = body;

  try {
    const options: { temperature?: number; maxOutputTokens?: number } = {};
    if (temperature !== undefined) {
      options.temperature = Math.max(0, Math.min(2, temperature));
    }
    if (maxOutputTokens !== undefined) {
      options.maxOutputTokens = Math.max(1, Math.min(8192, maxOutputTokens));
    }

    const text = await gemini.generateText(
      prompt,
      Object.keys(options).length > 0 ? options : undefined,
    );

    return jsonResponse({
      prompt,
      text,
      model: env.GEMINI_MODEL || "gemini-1.5-flash",
    });
  } catch (err) {
    // Handle rate limit errors with proper 429 response and headers
    if (err instanceof RateLimitError) {
      const retryAfter = err.details?.retryAfter as number | undefined;
      const response = errorResponse("RATE_LIMIT_EXCEEDED", err.message, 429, { retryAfter });
      if (retryAfter !== undefined) {
        response.headers.set("Retry-After", String(retryAfter));
      }
      return response;
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse("INTERNAL_ERROR", `Failed to generate text: ${message}`, 500, {
      prompt: prompt.substring(0, 100),
    });
  }
});

/**
 * 404 handler
 */
app.notFound(() => {
  return errorResponse("NOT_FOUND", "Endpoint not found", 404);
});

/**
 * Error handler
 */
app.onError((err) => {
  console.error("Worker error:", err);
  return errorResponse("INTERNAL_ERROR", err.message, 500);
});

// Export for Cloudflare Workers
export default app;
