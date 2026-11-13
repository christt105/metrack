import type { TransactionRunner } from './repositories/TransactionRunner.js';

/**
 * Runs the work with no atomicity at all, for D1, which has no interactive transactions. A failure halfway
 * leaves the writes made so far, so it is only for work that can be planned again from what it left, like the
 * Jellyfin sync.
 */
export class SequentialTransactionRunner implements TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
