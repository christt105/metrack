import type { R2Bucket } from '../../src/images/R2Bucket.js';
import type { D1Database } from '../../src/storage/d1/D1Database.js';
import type { D1PreparedStatement } from '../../src/storage/d1/D1PreparedStatement.js';

/**
 * Counts what a Cloudflare Worker bills as subrequests: every `fetch`, every D1 statement run on its own, every
 * D1 `batch` as one, and every R2 operation.
 */
export class SubrequestCounter {
  d1 = 0;
  r2 = 0;
  fetch = 0;
  /** The SQL of every counted D1 call, in order, to see where a request spends them. */
  readonly sql: string[] = [];

  get total(): number {
    return this.d1 + this.r2 + this.fetch;
  }

  reset(): void {
    this.d1 = 0;
    this.r2 = 0;
    this.fetch = 0;
    this.sql.length = 0;
  }

  database(db: D1Database): D1Database {
    const raw = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
    const wrap = (statement: D1PreparedStatement, text = ''): D1PreparedStatement => {
      const counted: D1PreparedStatement = {
        bind: (...values) => wrap(statement.bind(...values), text),
        first: () => {
          this.d1 += 1;
          this.sql.push(text.replace(/\s+/g, ' ').slice(0, 90));
          return statement.first();
        },
        all: () => {
          this.d1 += 1;
          this.sql.push(text.replace(/\s+/g, ' ').slice(0, 90));
          return statement.all();
        },
        run: () => {
          this.d1 += 1;
          this.sql.push(text.replace(/\s+/g, ' ').slice(0, 90));
          return statement.run();
        },
      };
      raw.set(counted, statement);
      return counted;
    };
    return {
      prepare: (sql) => wrap(db.prepare(sql), sql),
      batch: (statements) => {
        this.d1 += 1;
        this.sql.push(`batch of ${statements.length}`);
        return db.batch(statements.map((statement) => raw.get(statement) ?? statement));
      },
    };
  }

  bucket(bucket: R2Bucket): R2Bucket {
    return {
      get: (key) => {
        this.r2 += 1;
        return bucket.get(key);
      },
      put: (key, value) => {
        this.r2 += 1;
        return bucket.put(key, value);
      },
      head: (key) => {
        this.r2 += 1;
        return bucket.head(key);
      },
      delete: (key) => {
        this.r2 += 1;
        return bucket.delete(key);
      },
    };
  }
}
