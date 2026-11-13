import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashSecret } from '../src/auth/hashSecret.js';
import { createWorkerHandler } from '../src/worker/createWorkerHandler.js';
import { createWorkerApp } from '../src/worker/createWorkerApp.js';
import type { WorkerEnv } from '../src/worker/WorkerEnv.js';
import { WorkerUrlGuard } from '../src/worker/WorkerUrlGuard.js';
import { solidImage } from './support/sampleImages.js';

const SECRET = 'mt_test-secret-for-the-worker';

function statements(file: string): string[] {
  return readFileSync(new URL(file, import.meta.url), 'utf8')
    .split(/;\s*\n/)
    .map((sql) => sql.trim())
    .filter((sql) => sql.length > 0);
}

let miniflare: Miniflare;
let app: ReturnType<typeof createWorkerApp>;

beforeAll(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response(null); } };',
    d1Databases: { DB: 'metrack-test' },
    r2Buckets: ['IMAGES'],
  });
  const DB = await miniflare.getD1Database('DB');
  const IMAGES = await miniflare.getR2Bucket('IMAGES');
  const seed = [
    ...statements('../d1/migrations/0001_schema.sql'),
    ...statements('../d1/migrations/0002_public_render_cache.sql'),
    ...statements('../d1/seed/test-data.sql'),
    `INSERT INTO api_token (user_id, name, secret_hash, scope, created_at) VALUES (1, 'test', '${hashSecret(SECRET)}', 'write', '2026-01-01T00:00:00.000Z')`,
  ];
  await DB.batch(seed.map((sql) => DB.prepare(sql)));
  app = createWorkerApp({ DB, IMAGES, IMAGE_ENCODED_BY: 'server' } as unknown as WorkerEnv);
});

afterAll(async () => {
  await miniflare.dispose();
});

describe('Worker assets and image limits', () => {
  const asset = (answer: Response) => {
    const requested: string[] = [];
    const env = {
      ASSETS: {
        fetch: async (request: Request) => {
          requested.push(new URL(request.url).pathname);
          return answer;
        },
      },
    } as unknown as WorkerEnv;
    return { env, requested };
  };
  const context = {} as never;

  it('serves a hit under /assets as it is', async () => {
    const { env, requested } = asset(
      new Response('console.log(1)', { headers: { 'content-type': 'text/javascript' } }),
    );
    const response = await createWorkerHandler().fetch(
      new Request('http://localhost/assets/app.js'),
      env,
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('console.log(1)');
    expect(requested).toEqual(['/assets/app.js']);
  });

  it('answers a missing asset with an uncached JSON 404, never index.html', async () => {
    const { env } = asset(
      new Response('<!doctype html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    );
    const response = await createWorkerHandler().fetch(
      new Request('http://localhost/assets/old.js'),
      env,
      context,
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual({ error: 'Not found', code: 'not_found' });
  });

  it('reports the configured image dimension limit', async () => {
    const limited = createWorkerApp({
      DB: (await miniflare.getD1Database('DB')) as never,
      IMAGES: (await miniflare.getR2Bucket('IMAGES')) as never,
      IMAGE_MAX_DIMENSION: '1234',
    } as unknown as WorkerEnv);
    const usage = await limited.request('http://localhost/api/images/usage', { headers: auth });
    expect(await usage.json()).toMatchObject({ maxDimension: 1234 });
  });
});

const auth = { authorization: `Bearer ${SECRET}` };

describe('Worker app over D1 and R2', () => {
  it('reports the schema version from the applied migrations table', async () => {
    const response = await app.request('http://localhost/api/health');
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      schemaVersion: 0,
      features: { backups: false },
    });
  });

  it('signs in with a personal API token and lists the seeded titles', async () => {
    expect(
      await (await app.request('http://localhost/api/auth/me', { headers: auth })).json(),
    ).toMatchObject({
      id: 1,
      role: 'owner',
    });
    const page = (await (
      await app.request('http://localhost/api/media', { headers: auth })
    ).json()) as {
      total: number;
    };
    expect(page.total).toBe(5);
    expect((await app.request('http://localhost/api/media')).status).toBe(401);
  });

  it('adds and edits a hand-added title', async () => {
    const created = await app.request('http://localhost/api/games', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Added by hand' }),
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: number };
    const edited = await app.request(`http://localhost/api/games/${id}`, {
      method: 'PATCH',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed', rating: 8 }),
    });
    expect(await edited.json()).toMatchObject({ status: 'completed', rating: 8 });
  });

  it('accepts a WebP upload only, always validated and never re-encoded', async () => {
    const webp = await solidImage(20, 10, 'webp');
    const ok = await app.request('http://localhost/api/images', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'image/webp' },
      body: webp as Uint8Array<ArrayBuffer>,
    });
    expect(ok.status).toBe(201);
    const uploaded = (await ok.json()) as {
      ref: string;
      byteSize: number;
      usage: { imageEncoding: string };
    };
    expect(uploaded.byteSize).toBe(webp.length);
    expect(uploaded.usage.imageEncoding).toBe('client');
    const served = await app.request(`http://localhost${uploaded.ref}`, { headers: auth });
    expect(Buffer.from(await served.arrayBuffer()).equals(webp)).toBe(true);
    const png = await app.request('http://localhost/api/images', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'image/png' },
      body: (await solidImage(10, 10, 'png')) as Uint8Array<ArrayBuffer>,
    });
    expect(png.status).toBe(400);
  });

  it('serves the public page, its feed and the account export', async () => {
    const page = await app.request('http://localhost/u/test/');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Sample Movie');
    expect((await app.request('http://localhost/u/test/feed.xml')).status).toBe(200);
    const data = await app.request('http://localhost/api/account/export/data', { headers: auth });
    expect(data.status).toBe(200);
    expect(await data.json()).toMatchObject({ format: 1, user: { id: 1 } });
    const archive = await app.request('http://localhost/api/account/export', { headers: auth });
    expect(archive.status).toBe(404);
  });

  it('has no provider for movies without a TMDB key, and no sync or backup routes', async () => {
    const search = await app.request('http://localhost/api/search?type=movie&q=matrix', {
      headers: auth,
    });
    expect(await search.json()).toMatchObject({ code: 'provider_not_configured' });
    expect((await app.request('http://localhost/api/backups', { headers: auth })).status).toBe(404);
  });
});

describe('Worker ntfy topic routes', () => {
  it('registers the generated-topic routes behind a browser session', async () => {
    const post = await app.request('http://localhost/api/settings/ntfy-topic', {
      method: 'POST',
      headers: auth,
    });
    expect(post.status).toBe(403);
    const anonymous = await app.request('http://localhost/api/settings/ntfy-topic', {
      method: 'DELETE',
    });
    expect(anonymous.status).toBe(401);
  });
});

describe('WorkerUrlGuard', () => {
  const guard = new WorkerUrlGuard();
  it.each(['https://covers.example.com/a.jpg', 'http://example.org/b.png'])(
    'allows %s',
    async (url) => {
      await expect(guard.check(new URL(url))).resolves.toBeUndefined();
    },
  );
  it.each([
    'ftp://example.com/a.png',
    'http://127.0.0.1/a.png',
    'http://[::1]/a.png',
    'http://localhost/a.png',
    'http://printer.local/a.png',
    'http://intranet/a.png',
  ])('refuses %s', async (url) => {
    await expect(guard.check(new URL(url))).rejects.toMatchObject({ code: 'url_not_allowed' });
  });
});
