import type { D1Database } from '../../src/storage/d1/D1Database.js';
import type { D1PreparedStatement } from '../../src/storage/d1/D1PreparedStatement.js';
import type { SqlValue } from '../../src/storage/mapping/SqlValue.js';
import type { RecordedStatement } from './RecordedStatement.js';

/** Wraps a database so every statement bound through it is added to `log`, with the values it ran with. */
export function recordStatements(db: D1Database, log: RecordedStatement[]): D1Database {
  const wrap = (sql: string, inner: D1PreparedStatement): D1PreparedStatement => {
    const record = (params: SqlValue[]): void => {
      log.push({ sql, params });
    };
    return {
      bind(...values: SqlValue[]) {
        record(values);
        return wrap(sql, inner.bind(...values));
      },
      first: () => inner.first(),
      all: () => inner.all(),
      run: () => inner.run(),
    };
  };
  return {
    prepare: (sql) => wrap(sql, db.prepare(sql)),
    batch: (statements) => db.batch(statements),
  };
}
