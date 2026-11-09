import type { D1Database } from '../../src/storage/d1/D1Database.js';
import type { D1PreparedStatement } from '../../src/storage/d1/D1PreparedStatement.js';
import type { SqlValue } from '../../src/storage/mapping/SqlValue.js';
import type { RecordedStatement } from './RecordedStatement.js';

/** Wraps a database so every statement bound through it is added to `log`, with the values it ran with. */
export function recordStatements(db: D1Database, log: RecordedStatement[]): D1Database {
  const inners = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
  const wrap = (sql: string, inner: D1PreparedStatement): D1PreparedStatement => {
    const wrapper: D1PreparedStatement = {
      bind(...values: SqlValue[]) {
        log.push({ sql, params: values });
        return wrap(sql, inner.bind(...values));
      },
      first: () => inner.first(),
      all: () => inner.all(),
      run: () => inner.run(),
    };
    inners.set(wrapper, inner);
    return wrapper;
  };
  return {
    prepare: (sql) => wrap(sql, db.prepare(sql)),
    batch: (statements) => db.batch(statements.map((s) => inners.get(s) ?? s)),
  };
}
