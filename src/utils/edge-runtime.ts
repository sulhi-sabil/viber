/**
 * Edge Runtime Detection Utility
 *
 * Detects whether the code is running in an edge runtime environment
 * (e.g., Cloudflare Workers, Vercel Edge Functions) vs Node.js or browser.
 *
 * Edge runtimes like Cloudflare Workers don't have localStorage or
 * certain Node.js globals like process.cwd.
 */

/**
 * Checks if the current environment is an edge runtime.
 *
 * In Cloudflare Workers/Browser workers: localStorage is undefined
 * In Node.js: localStorage is undefined, but process.cwd exists
 *
 * @returns true if running in an edge runtime, false otherwise
 */
export function isEdgeRuntime(): boolean {
  return (
    typeof localStorage === "undefined" && typeof process?.cwd !== "function"
  );
}
