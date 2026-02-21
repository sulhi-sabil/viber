/**
 * Cloudflare Workers environment bindings
 * Extend this interface with your specific bindings
 */
export interface CloudflareEnv {
  // Database
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // External APIs
  GEMINI_API_KEY: string;

  // Environment
  ENVIRONMENT?: "development" | "staging" | "production";
  LOG_LEVEL?: "debug" | "info" | "warn" | "error";
}

/**
 * Type guard to check if an object is a valid CloudflareEnv
 */
export function isCloudflareEnv(env: unknown): env is CloudflareEnv {
  if (typeof env !== "object" || env === null) return false;
  const e = env as Record<string, unknown>;
  return (
    typeof e.SUPABASE_URL === "string" &&
    typeof e.SUPABASE_ANON_KEY === "string" &&
    typeof e.SUPABASE_SERVICE_ROLE_KEY === "string" &&
    typeof e.GEMINI_API_KEY === "string"
  );
}
