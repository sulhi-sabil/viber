/**
 * Lazy service initialization for Vercel serverless functions
 * Services are initialized on-demand from environment variables
 */

import {
  parseEnvInt,
  GEMINI_DEFAULT_MODEL,
  ServiceFactory,
  type SupabaseConfig,
  type GeminiConfig,
  type SupabaseService,
  type GeminiService,
} from "../../src/index";

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
    timeout: parseEnvInt(process.env.SUPABASE_TIMEOUT, 10000),
    maxRetries: parseEnvInt(process.env.SUPABASE_MAX_RETRIES, 3),
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
    timeout: parseEnvInt(process.env.GEMINI_TIMEOUT, 30000),
    maxRetries: parseEnvInt(process.env.GEMINI_MAX_RETRIES, 3),
    rateLimitRequests: parseEnvInt(process.env.GEMINI_RATE_LIMIT_REQUESTS, 15),
    rateLimitWindow: parseEnvInt(process.env.GEMINI_RATE_LIMIT_WINDOW, 60000),
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
