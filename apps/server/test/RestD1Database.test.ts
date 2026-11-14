import { describe, expect, it } from 'vitest';
import { MAX_REQUEST_BYTES, RestD1Database } from '../src/cloudcleanup/RestD1Database.js';

const config = { accountId: 'acct', databaseId: 'db1', token: 'tok' };

function server(answer: () => Response) {
  const calls: { url: string; headers: Record<string, string>; body: unknown }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(String(init.body)),
    });
    return answer();
  }) as unknown as typeof fetch;
  return { calls, db: new RestD1Database(config, fetchFn) };
}

const ok = (...results: object[]) =>
  Response.json({ success: true, result: results.map((r) => ({ success: true, ...r })) });

describe('RestD1Database', () => {
  it('sends one statement as sql and params and maps rows and meta', async () => {
    const { calls, db } = server(() =>
      ok({ results: [{ a: 1 }], meta: { changes: 2, last_row_id: 7 } }),
    );
    const result = await db.prepare('SELECT ?').bind('x').all();
    expect(result).toEqual({ results: [{ a: 1 }], meta: { changes: 2, last_row_id: 7 } });
    expect(calls[0]).toEqual({
      url: 'https://api.cloudflare.com/client/v4/accounts/acct/d1/database/db1/query',
      headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
      body: { sql: 'SELECT ?', params: ['x'] },
    });
  });

  it('answers the first row or null', async () => {
    expect(
      await server(() => ok({ results: [{ a: 1 }, { a: 2 }] }))
        .db.prepare('S')
        .first(),
    ).toEqual({ a: 1 });
    expect(
      await server(() => ok({ results: [] }))
        .db.prepare('S')
        .first(),
    ).toBeNull();
  });

  it('sends a batch as one request with every statement in order', async () => {
    const { calls, db } = server(() => ok({ results: [] }, { results: [{ b: 1 }] }));
    const results = await db.batch([db.prepare('A').bind(1), db.prepare('B')]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({
      batch: [
        { sql: 'A', params: [1] },
        { sql: 'B', params: [] },
      ],
    });
    expect(results.map((r) => r.results)).toEqual([[], [{ b: 1 }]]);
    expect(await db.batch([])).toEqual([]);
  });

  it('fails with the error messages of the API', async () => {
    const { db } = server(() =>
      Response.json({ success: false, errors: [{ message: 'no such table' }] }, { status: 400 }),
    );
    await expect(db.prepare('S').all()).rejects.toThrow('D1 query failed: no such table');
  });

  it('fails when a statement of the batch fails or an answer is missing', async () => {
    const failed = server(() => Response.json({ success: true, result: [{ success: false }] }));
    await expect(failed.db.batch([failed.db.prepare('A')])).rejects.toThrow('D1 query failed');
    const short = server(() => ok({ results: [] }));
    await expect(short.db.batch([short.db.prepare('A'), short.db.prepare('B')])).rejects.toThrow(
      'D1 query failed',
    );
  });

  it('refuses a request that is too large instead of splitting it', async () => {
    const { calls, db } = server(() => ok({ results: [] }));
    await expect(db.prepare('A').bind('x'.repeat(MAX_REQUEST_BYTES)).run()).rejects.toThrow(
      'too large',
    );
    expect(calls).toEqual([]);
  });
});
