import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashSecret } from '../src/auth/hashSecret.js';
import type { WorkerEnv } from '../src/worker/WorkerEnv.js';
import { createWorkerApp } from '../src/worker/createWorkerApp.js';

const BASE = 'http://localhost';
const OWNER = 'mt_etag-owner-secret';
const OTHER = 'mt_etag-other-secret';
const json = (secret: string) => ({
  authorization: `Bearer ${secret}`,
  'content-type': 'application/json',
});

function statements(file: URL): string[] {
  return readFileSync(file, 'utf8')
    .split(/;\s*\n/)
    .map((sql) => sql.trim())
    .filter((sql) => sql.length > 0);
}

let miniflare: Miniflare;
let app: ReturnType<typeof createWorkerApp>;
let DB: Awaited<ReturnType<Miniflare['getD1Database']>>;
let queries: string[];

beforeAll(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response(null); } };',
    d1Databases: { DB: 'metrack-media-etag' },
    r2Buckets: ['IMAGES'],
  });
  DB = await miniflare.getD1Database('DB');
  const IMAGES = await miniflare.getR2Bucket('IMAGES');
  const folder = new URL('../d1/migrations/', import.meta.url);
  const files = readdirSync(folder)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of files) {
    for (const sql of statements(new URL(file, folder))) await DB.prepare(sql).run();
  }
  const spy = {
    prepare: (sql: string) => {
      queries.push(sql);
      return DB.prepare(sql);
    },
    batch: (list: never[]) => DB.batch(list),
  };
  app = createWorkerApp({ DB: spy, IMAGES, IMAGE_ENCODED_BY: 'server' } as unknown as WorkerEnv);
});

afterAll(async () => {
  await miniflare.dispose();
});

beforeEach(async () => {
  queries = [];
  for (const table of [
    'api_token',
    'session',
    'movie_entry',
    'movie',
    'videogame_entry',
    'videogame',
    'user_setting',
    'user',
  ]) {
    await DB.prepare(`DELETE FROM ${table}`).run();
  }
  await DB.prepare(
    `INSERT INTO user (id, name, created_at, role) VALUES (1, 'Owner', '2026-01-01', 'owner'), (2, 'Other', '2026-01-01', 'trusted')`,
  ).run();
  for (const [id, secret] of [
    [1, OWNER],
    [2, OTHER],
  ] as const) {
    await DB.prepare(
      `INSERT INTO api_token (user_id, name, secret_hash, scope, created_at) VALUES (${id}, 't', '${hashSecret(secret)}', 'write', '2026-01-01T00:00:00.000Z')`,
    ).run();
  }
});

const list = (secret: string, query = '', headers: Record<string, string> = {}) =>
  app.request(`${BASE}/api/media${query}`, {
    headers: { authorization: `Bearer ${secret}`, ...headers },
  });
const etagOf = async (secret: string, query = ''): Promise<string> =>
  (await list(secret, query)).headers.get('etag') ?? '';
const write = (secret: string, method: string, path: string, body?: unknown) =>
  app.request(`${BASE}${path}`, {
    method,
    headers: json(secret),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('GET /api/media validator', () => {
  it('sends a strong ETag and no-cache on the 200', async () => {
    const response = await list(OWNER);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]{64}"$/);
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
  });

  it('stays the same without writes and changes after an own edit', async () => {
    const before = await etagOf(OWNER);
    expect(await etagOf(OWNER)).toBe(before);
    expect((await write(OWNER, 'POST', '/api/games', { title: 'First' })).status).toBe(201);
    const after = await etagOf(OWNER);
    expect(after).not.toBe(before);
    expect(await etagOf(OWNER)).toBe(after);
  });

  it('changes when another user writes', async () => {
    const before = await etagOf(OWNER);
    expect((await write(OTHER, 'POST', '/api/games', { title: 'Theirs' })).status).toBe(201);
    expect(await etagOf(OWNER)).not.toBe(before);
  });

  it('changes when a user is deleted', async () => {
    const before = await etagOf(OWNER);
    await DB.prepare('DELETE FROM api_token WHERE user_id = 2').run();
    await DB.prepare('DELETE FROM user WHERE id = 2').run();
    expect(await etagOf(OWNER)).not.toBe(before);
  });

  it('differs per user and per filter, but not per parameter order', async () => {
    expect(await etagOf(OTHER)).not.toBe(await etagOf(OWNER));
    expect(await etagOf(OWNER, '?type=movie')).not.toBe(await etagOf(OWNER));
    expect(await etagOf(OWNER, '?status=planned')).not.toBe(await etagOf(OWNER, '?type=movie'));
    expect(await etagOf(OWNER, '?q=a')).not.toBe(await etagOf(OWNER, '?q=b'));
    expect(await etagOf(OWNER, '?limit=10')).not.toBe(await etagOf(OWNER, '?limit=20'));
    expect(await etagOf(OWNER, '?offset=1')).not.toBe(await etagOf(OWNER));
    expect(await etagOf(OWNER, '?type=movie&status=planned&order=desc')).toBe(
      await etagOf(OWNER, '?order=desc&status=planned&type=movie'),
    );
  });

  it('treats a default parameter like an omitted one', async () => {
    expect(await etagOf(OWNER, '?sort=title&order=asc&limit=50&offset=0')).toBe(
      await etagOf(OWNER),
    );
  });
});

describe('GET /api/media conditional requests', () => {
  it('answers 304 with the headers and no body to a matching tag', async () => {
    const etag = await etagOf(OWNER);
    const response = await list(OWNER, '', { 'if-none-match': etag });
    expect(response.status).toBe(304);
    expect(response.headers.get('etag')).toBe(etag);
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
    expect(await response.text()).toBe('');
  });

  it('matches weak tags, lists of tags and *', async () => {
    const etag = await etagOf(OWNER);
    for (const header of [`W/${etag}`, `"nope", ${etag}`, `"nope", W/${etag}`, '*']) {
      expect((await list(OWNER, '', { 'if-none-match': header })).status).toBe(304);
    }
  });

  it('answers 200 with the new body and tag to a stale tag', async () => {
    const stale = await etagOf(OWNER);
    await write(OWNER, 'POST', '/api/games', { title: 'Fresh' });
    const response = await list(OWNER, '', { 'if-none-match': stale });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).not.toBe(stale);
    expect(((await response.json()) as { total: number }).total).toBe(1);
  });

  it('does not accept the tag of another user or filter', async () => {
    const other = await etagOf(OTHER);
    expect((await list(OWNER, '', { 'if-none-match': other })).status).toBe(200);
    const filtered = await etagOf(OWNER, '?type=movie');
    expect((await list(OWNER, '', { 'if-none-match': filtered })).status).toBe(200);
  });

  it('does not read the library on a 304', async () => {
    const etag = await etagOf(OWNER);
    queries = [];
    expect((await list(OWNER, '', { 'if-none-match': etag })).status).toBe(304);
    expect(queries.filter((sql) => /\b(movie|series|season|game|book)\b/.test(sql))).toEqual([]);
    expect(queries.some((sql) => sql.includes('SUM(content_version)'))).toBe(true);
  });
});
