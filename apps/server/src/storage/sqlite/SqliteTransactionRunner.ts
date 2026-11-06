import type { DatabaseSync } from 'node:sqlite';
import type { TransactionRunner } from '../repositories/TransactionRunner.js';

/**
 * Wraps work in `BEGIN`/`COMMIT` on the shared connection, one transaction at a time. The work must only
 * touch the database: awaiting network or disk inside it would let other writes land in the transaction.
 */
export class SqliteTransactionRunner implements TransactionRunner {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: DatabaseSync) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(() => this.transact(work));
    this.tail = next.catch(() => undefined);
    return next;
  }

  private async transact<T>(work: () => Promise<T>): Promise<T> {
    this.db.exec('BEGIN');
    try {
      const result = await work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
