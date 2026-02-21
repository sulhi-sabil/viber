/**
 * Timing utilities for async operations
 * @module utils/timing
 */

/**
 * Promise-based sleep with unref for non-blocking behavior
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const timerRef = timer as unknown as { unref?: () => void };
    if (typeof timerRef.unref === "function") {
      timerRef.unref();
    }
  });
}
