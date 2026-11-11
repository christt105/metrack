import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashSecret } from '../src/auth/hashSecret.js';
import { matchesEtag } from '../src/site/matchesEtag.js';
import { renderEtag } from '../src/site/renderEtag.js';
import { createWorkerApp } from '../src/worker/createWorkerApp.js';
import type { WorkerEnv } from '../src/worker/WorkerEnv.js';

const SECRET = 'mt_test-secret-for-the-render-cache';
const auth = { authorization: `Bearer ${SECRET}` };
const json = { ...auth, 'content-type': 'application/json' };
const BASE = 'http://localhost';

function statements(file: string): string[] {
  return readFileSync(new URL(file, import.meta.url), 'utf8')
    .split(/;\s*\n/)
    .map((sql) => sql.trim())
    .filter((sql) => sql.length > 0);
}

let miniflare: Miniflare;
let app: ReturnType<typeof createWorkerApp>;
let DB: Awaited<ReturnType<Miniflare['getD1Database']>>;
let reads: string[];
const START = Date.parse('2026-06-01T12:00:00Z');
let clock = START;
const RENDERED_AT = START / 1000;

beforeAll(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response(null); } };',
    d1Databases: { DB: 'metrack-render-cache' },
    r2Buckets: ['IMAGES'],
  });
  DB = await miniflare.getD1Database('DB');
  const IMAGES = await miniflare.getR2Bucket('IMAGES');
  await DB.batch(
    [
      ...statements('../d1/migrations/0001_schema.sql'),
      ...statements('../d1/migrations/0002_public_render_cache.sql'),
    ].map((sql) => DB.prepare(sql)),
  );
  const spy = {
    prepare: (sql: string) => {
      reads.push(sql);
      return DB.prepare(sql);
    },
    batch: (list: never[]) => DB.batch(list),
  };
  app = createWorkerApp(
    { DB: spy, IMAGES, IMAGE_ENCODED_BY: 'server' } as unknown as WorkerEnv,
    () => new Date(clock),
  );
});

afterAll(async () => {
  await miniflare.dispose();
});

beforeEach(async () => {
  reads = [];
  clock = START;
  await DB.batch(
    [
      'DELETE FROM public_render',
      'DELETE FROM api_token',
      'DELETE FROM session',
      'DELETE FROM movie_entry',
      'DELETE FROM movie',
      'DELETE FROM user_setting',
      'DELETE FROM user',
      ...statements('../d1/seed/test-data.sql'),
      `INSERT INTO api_token (user_id, name, secret_hash, scope, created_at) VALUES (1, 'test', '${hashSecret(SECRET)}', 'write', '2026-01-01T00:00:00.000Z')`,
    ].map((sql) => DB.prepare(sql)),
  );
});

const version = async (): Promise<number> =>
  Number((await DB.prepare('SELECT content_version AS v FROM user WHERE id = 1').first())?.v);
const stored = async (): Promise<number> =>
  Number((await DB.prepare('SELECT COUNT(*) AS n FROM public_render').first())?.n);
const get = (path: string, headers: Record<string, string> = {}) =>
  app.request(`${BASE}${path}`, { headers });
const write = (method: string, path: string, body?: unknown) =>
  app.request(`${BASE}${path}`, {
    method,
    headers: json,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('the content version', () => {
  it('goes up once per successful write of the signed-in user', async () => {
    expect(await version()).toBe(0);
    expect((await write('POST', '/api/games', { title: 'First' })).status).toBe(201);
    expect(await version()).toBe(1);
    expect((await write('PATCH', '/api/games/1', { rating: 5 })).status).toBe(200);
    expect(await version()).toBe(2);
  });

  it('stays put for reads, failed writes and anonymous requests', async () => {
    await get('/api/media', auth);
    await get('/u/test/');
    expect((await write('PATCH', '/api/games/999', { rating: 5 })).status).toBe(404);
    expect((await app.request(`${BASE}/api/games`, { method: 'POST', body: '{}' })).status).toBe(
      401,
    );
    expect(await version()).toBe(0);
  });

  it('covers the settings of the public page itself', async () => {
    const before = await version();
    await DB.prepare(
      `INSERT INTO session (id, user_id, created_at, expires_at) VALUES ('${hashSecret(SECRET)}', 1, '2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z')`,
    ).run();
    const response = await app.request(`${BASE}/api/settings/public-page`, {
      method: 'PATCH',
      headers: { cookie: `metrack_session=${SECRET}`, 'content-type': 'application/json' },
      body: JSON.stringify({ handle: 'test', enabled: false }),
    });
    expect(response.status).toBe(200);
    expect(await version()).toBe(before + 1);
    expect((await get('/u/test/')).status).toBe(404);
  });
});

describe('a public page', () => {
  it('is rendered on a miss, stored and served from the store afterwards', async () => {
    const first = await get('/u/test/');
    expect(first.status).toBe(200);
    expect(await stored()).toBe(1);
    await DB.prepare("UPDATE movie SET title = 'Changed behind the cache' WHERE id = 1").run();
    const second = await get('/u/test/');
    expect(await second.text()).toContain('Sample Movie');
    expect(second.headers.get('cache-control')).toBe('no-cache');
    expect(second.headers.get('content-type')).toBe(first.headers.get('content-type'));
  });

  it('costs no library read on a hit', async () => {
    await get('/u/test/stats');
    reads = [];
    const hit = await get('/u/test/stats');
    expect(hit.status).toBe(200);
    expect(reads).toHaveLength(1);
    expect(reads[0]).toContain('public_render');
  });

  it('answers 304 to a matching If-None-Match, with a strong ETag of user, version and page', async () => {
    const first = await get('/u/test/');
    const etag = first.headers.get('etag');
    expect(etag).toBe(renderEtag(1, 0, RENDERED_AT, 'home'));
    expect(etag).not.toMatch(/^W\//);
    const again = await get('/u/test/', { 'if-none-match': etag ?? '' });
    expect(again.status).toBe(304);
    expect(await again.text()).toBe('');
    expect(again.headers.get('etag')).toBe(etag);
    expect((await get('/u/test/', { 'if-none-match': '"other"' })).status).toBe(200);
    expect((await get('/u/test/', { 'if-none-match': '*' })).status).toBe(304);
  });

  it('does not answer 304 for a page that is not stored yet', async () => {
    const etag = renderEtag(1, 0, RENDERED_AT, 'index.json');
    expect((await get('/u/test/index.json', { 'if-none-match': etag })).status).toBe(200);
    expect(await stored()).toBe(1);
  });

  it('expires a stored render after a day: it is rendered again with a new ETag', async () => {
    const first = await get('/u/test/');
    const etag = first.headers.get('etag') ?? '';
    clock = START + 23 * 3_600_000;
    expect((await get('/u/test/', { 'if-none-match': etag })).status).toBe(304);
    await DB.prepare("UPDATE movie SET title = 'Changed behind the cache' WHERE id = 1").run();
    clock = START + 24 * 3_600_000;
    const expired = await get('/u/test/', { 'if-none-match': etag });
    expect(expired.status).toBe(200);
    expect(expired.headers.get('etag')).toBe(renderEtag(1, 0, RENDERED_AT + 86_400, 'home'));
    expect(expired.headers.get('etag')).not.toBe(etag);
    expect(await expired.text()).toContain('Changed behind the cache');
    const again = await get('/u/test/', { 'if-none-match': expired.headers.get('etag') ?? '' });
    expect(again.status).toBe(304);
  });

  it('is rebuilt after a write, with a new ETag and the new content', async () => {
    const first = await get('/u/test/movie/1');
    await write('PATCH', '/api/movies/1', { review: 'Rewritten after the first visit' });
    const stale = await get('/u/test/movie/1', {
      'if-none-match': first.headers.get('etag') ?? '',
    });
    expect(stale.status).toBe(200);
    expect(stale.headers.get('etag')).toBe(renderEtag(1, 1, RENDERED_AT, 'movie/1'));
    expect(await stale.text()).toContain('Rewritten after the first visit');
  });

  it('does not rebuild on write, only on the next visit', async () => {
    await get('/u/test/');
    await write('POST', '/api/games', { title: 'Another' });
    await write('POST', '/api/games', { title: 'And another' });
    expect(await stored()).toBe(1);
    expect(Number((await DB.prepare('SELECT version AS v FROM public_render').first())?.v)).toBe(0);
    await get('/u/test/');
    expect(Number((await DB.prepare('SELECT version AS v FROM public_render').first())?.v)).toBe(2);
    expect(await stored()).toBe(1);
  });

  it('keeps one row per page and never stores a 404', async () => {
    for (const path of ['/u/test/', '/u/test/stats', '/u/test/movie/1', '/u/test/feed.xml']) {
      expect((await get(path)).status).toBe(200);
    }
    expect((await get('/u/test/movie/99')).status).toBe(404);
    expect((await get('/u/nobody/')).status).toBe(404);
    expect(await stored()).toBe(4);
  });

  it('keeps the feed of each address apart', async () => {
    await get('/u/test/feed.xml');
    const other = await get('/u/test/feed.xml', { host: 'other.example' });
    expect(await other.text()).toContain('http://other.example');
  });

  it('is not stored when it is over 1 MB, but is still served', async () => {
    await DB.prepare('UPDATE movie_entry SET review = ? WHERE movie_id = 1')
      .bind('x'.repeat(1_100_000))
      .run();
    const response = await get('/u/test/movie/1');
    expect(response.status).toBe(200);
    expect((await response.text()).length).toBeGreaterThan(1_000_000);
    expect(await stored()).toBe(0);
  });
});

describe('the ETag helpers', () => {
  it('match listed, weak and wildcard validators only', () => {
    expect(matchesEtag(null, '"a"')).toBe(false);
    expect(matchesEtag('"b", "a"', '"a"')).toBe(true);
    expect(matchesEtag('W/"a"', '"a"')).toBe(true);
    expect(matchesEtag('*', '"a"')).toBe(true);
    expect(matchesEtag('"ab"', '"a"')).toBe(false);
  });
});
