import type { TransactionRunner } from '../repositories/TransactionRunner.js';

/**
 * D1 has no interactive transactions, so work that reads and writes across awaits cannot be made atomic.
 * Only the vault import and the Jellyfin sync need it, and both run against SQLite at home. Cloud code
 * that needs atomicity groups its statements in `D1Database.batch`.
 */
export class D1TransactionRunner implements TransactionRunner {
  run<T>(): Promise<T> {
    return Promise.reject(
      new Error('D1 has no interactive transactions: run this at home on SQLite, or use batch()'),
    );
  }
}
