import type { Row } from '../storage/mapping/Row.js';
import type { SqlValue } from '../storage/mapping/SqlValue.js';
import type { D1PreparedStatement } from '../storage/d1/D1PreparedStatement.js';
import type { D1Result } from '../storage/d1/D1Result.js';
import type { RestD1Database } from './RestD1Database.js';
import type { RestStatement } from './RestStatement.js';

/** A statement of a `RestD1Database`; it runs when `all`, `first` or `run` is awaited, or as part of a `batch`. */
export class RestD1PreparedStatement implements D1PreparedStatement {
  constructor(
    private readonly db: RestD1Database,
    private readonly sql: string,
    private readonly values: SqlValue[] = [],
  ) {}

  bind(...values: SqlValue[]): D1PreparedStatement {
    return new RestD1PreparedStatement(this.db, this.sql, values);
  }

  get body(): RestStatement {
    return { sql: this.sql, params: this.values };
  }

  async first(): Promise<Row | null> {
    return (await this.all()).results[0] ?? null;
  }

  async all(): Promise<D1Result> {
    return (await this.db.query([this.body], false))[0]!;
  }

  run(): Promise<D1Result> {
    return this.all();
  }
}
