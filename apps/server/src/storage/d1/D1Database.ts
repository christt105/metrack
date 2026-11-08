import type { D1PreparedStatement } from './D1PreparedStatement.js';
import type { D1Result } from './D1Result.js';

/**
 * The part of a Cloudflare D1 binding the repositories use. `batch` runs its statements in order inside one
 * implicit transaction, which is the only atomicity D1 offers.
 */
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
