import { RETRY_DELAYS_MS } from './RETRY_DELAYS_MS.js';

/** How long to wait before retrying after this many failures in a row. */
export function retryDelay(failures: number): number {
  return RETRY_DELAYS_MS[Math.min(Math.max(failures, 1), RETRY_DELAYS_MS.length) - 1]!;
}
