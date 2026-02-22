/**
 * Lazy service initialization for Vercel serverless functions
 * Services are initialized on-demand from environment variables
 */

import {
  ServiceFactory,
  type SupabaseConfig,
  type GeminiConfig,
  type SupabaseService,
  type GeminiService,
} from "../../src/index";
import {
  DEFAULT_OPERATION_TIMEOUT_MS,
  DEFAULT_MAX_RETRY_ATTEMPTS,
  GEMINI_DEFAULT_MODEL,
  STREAMING_TIMEOUT_MS,
  RATE_LIMITER_DEFAULT_MAX_REQUESTS,
  RATE_LIMITER_DEFAULT_WINDOW_MS,
} from "../../src/config/constants";

// Cache service instances per cold start
let supabaseInstance: SupabaseService | null = null;
let geminiInstance: GeminiService | null = null;
let factoryInstance: ServiceFactory | null = null;

/**
 * Get or create the ServiceFactory singleton
 */
export function getServiceFactory(): ServiceFactory {
  if (!factoryInstance) {
    factoryInstance = ServiceFactory.getInstance();
  }
  return factoryInstance;
}

/**
 * Get or create a Supabase client
 * Returns null if required environment variables are missing
 */
export function getSupabase(): SupabaseService | null {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  const config: SupabaseConfig = {
    url,
    anonKey,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    timeout: parseInt(process.env.SUPABASE_TIMEOUT || String(DEFAULT_OPERATION_TIMEOUT_MS), 10),
    maxRetries: parseInt(process.env.SUPABASE_MAX_RETRIES || String(DEFAULT_MAX_RETRY_ATTEMPTS), 10),
  };

  supabaseInstance = getServiceFactory().createSupabaseClient(config);
  return supabaseInstance;
}

/**
 * Get or create a Gemini client
 * Returns null if required environment variables are missing
 */
export function getGemini(): GeminiService | null {
  if (geminiInstance) {
    return geminiInstance;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const config: GeminiConfig = {
    apiKey,
    model: process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
    timeout: parseInt(process.env.GEMINI_TIMEOUT || String(STREAMING_TIMEOUT_MS), 10),
    maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES || String(DEFAULT_MAX_RETRY_ATTEMPTS), 10),
    rateLimitRequests: parseInt(
      process.env.GEMINI_RATE_LIMIT_REQUESTS || String(RATE_LIMITER_DEFAULT_MAX_REQUESTS),
      10,
    ),
    rateLimitWindow: parseInt(
      process.env.GEMINI_RATE_LIMIT_WINDOW || String(RATE_LIMITER_DEFAULT_WINDOW_MS),
      10,
    ),
  };

  geminiInstance = getServiceFactory().createGeminiClient(config);
  return geminiInstance;
}

/**
 * Check which services are configured
 */
export function getConfiguredServices(): {
  supabase: boolean;
  gemini: boolean;
} {
  return {
    supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    gemini: !!process.env.GEMINI_API_KEY,
  };
}

/**
 * Reset all cached service instances
 * Useful for testing or reconfiguration
 */
export function resetServices(): void {
  supabaseInstance = null;
  geminiInstance = null;
  factoryInstance = null;
  getServiceFactory().resetAllServices();
}
