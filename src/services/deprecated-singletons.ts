/**
 * @deprecated This module contains deprecated singleton functions.
 * Use serviceFactory.createSupabaseClient() and serviceFactory.createGeminiClient() for new code.
 *
 * These functions were moved from supabase.ts and gemini.ts to resolve circular import issues.
 * The service files imported serviceFactory at the bottom of the file, which created potential
 * circular dependency risks. By extracting these deprecated functions to a separate module,
 * we maintain backward compatibility while improving modularity.
 */

import { serviceFactory } from "../utils/service-factory";
import { SupabaseService, SupabaseConfig } from "./supabase";
import { GeminiService, GeminiConfig } from "./gemini";

// Singleton instances for backward compatibility
let supabaseInstance: SupabaseService | null = null;
let geminiInstance: GeminiService | null = null;

/**
 * Create a singleton Supabase client using ServiceFactory
 * @deprecated Use serviceFactory.createSupabaseClient() for new code
 * @param config - Supabase configuration
 * @returns SupabaseService instance
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseService {
  // Use ServiceFactory for proper singleton management with health checks and metrics
  const service = serviceFactory.createSupabaseClient(config);
  supabaseInstance = service;
  return service;
}

/**
 * Get the current Supabase client instance
 * @deprecated Use serviceFactory.getService() for new code
 * @returns SupabaseService instance or null
 */
export function getSupabaseClient(): SupabaseService | null {
  return supabaseInstance;
}

/**
 * Reset the Supabase client instance
 * @deprecated Use serviceFactory.resetService() for new code
 */
export function resetSupabaseClient(): void {
  serviceFactory.resetService("supabase");
  supabaseInstance = null;
}

/**
 * Create a singleton Gemini client using ServiceFactory
 * @deprecated Use serviceFactory.createGeminiClient() for new code
 * @param config - Gemini configuration
 * @returns GeminiService instance
 */
export function createGeminiClient(config: GeminiConfig): GeminiService {
  // Use ServiceFactory for proper singleton management with health checks and metrics
  const service = serviceFactory.createGeminiClient(config);
  geminiInstance = service;
  return service;
}

/**
 * Get the current Gemini client instance
 * @deprecated Use serviceFactory.getService() for new code
 * @returns GeminiService instance or null
 */
export function getGeminiClient(): GeminiService | null {
  return geminiInstance;
}

/**
 * Reset the Gemini client instance
 * @deprecated Use serviceFactory.resetService() for new code
 */
export function resetGeminiClient(): void {
  serviceFactory.resetService("gemini");
  geminiInstance = null;
}
