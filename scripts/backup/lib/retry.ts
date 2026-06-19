/**
 * Exponential backoff retry for transient failures (network, upload timeouts).
 */

import { logger } from "./logger.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    label?: string;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, label = "operation" } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        logger.warn("retry.attempt_failed", {
          label,
          attempt,
          maxAttempts,
          nextRetryMs: delayMs,
          error: String(err),
        });
        await sleep(delayMs);
      }
    }
  }

  throw new Error(
    `${label} failed after ${maxAttempts} attempts: ${String(lastError)}`
  );
}
