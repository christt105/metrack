import { Miniflare } from 'miniflare';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { STEAM_APPLY_BATCH_SIZE } from '@metrack/domain';
import { hashSecret } from '../src/auth/hashSecret.js';
import { GAME_ARTWORK_COST } from '../src/backfill/GameArtworkCost.js';
import { STEAM_APPLY_BUDGET } from '../src/steam/SteamApplyBudget.js';
import type { D1Database } from '../src/storage/d1/D1Database.js';
import { createWorkerApp } from '../src/worker/createWorkerApp.js';
import type { WorkerEnv } from '../src/worker/WorkerEnv.js';
import { D1_OWNER, D1_SCHEMA } from './support/d1Backend.js';
import { solidImage } from './support/sampleImages.js';
import { SubrequestCounter } from './support/SubrequestCounter.js';

const FREE_PLAN_SUBREQUESTS = 50;
const SECRET = 'mt_steam-budget-secret';
const STEAM_ID = '76561198012345678';
const GAMES = Array.from({ length: 40 }, (_, index) => ({
  appid: 1000 + index,
  name: `Game ${index}`,
  playtime_forever: 60 + index,
  playtime_2weeks: index % 2 === 0 ? 5 : 0,
}));

const MISSING_STEAM_ART = new Set([1002, 1003, 1019]);

let miniflare: Miniflare;
let rawDb: D1Database;
let app: ReturnType<typeof createWorkerApp>;
const counter = new SubrequestCounter();

async function network(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  counter.fetch += 1;
  const target = new URL(input instanceof Request ? input.url : input.toString());
  const url = `${target.origin}${target.pathname}`;
  if (url.endsWith('/GetOwnedGames/v1/')) {
    return Response.json({ response: { games: GAMES } });
  }
  if (url === 'https://id.twitch.tv/oauth2/token') {
    return Response.json({ access_token: 't', expires_in: 3600 });
  }
  if (url === 'https://api.igdb.com/v4/external_games') {
    const uids = [...String(init?.body).matchAll(/"(\d+)"/g)].map((m) => m[1] ?? '');
    return Response.json(uids.map((uid) => ({ id: 1, uid, game: 100_000 + Number(uid) })));
  }
  if (url === 'https://api.igdb.com/v4/games') {
    const id = Number(/where id = (\d+);/.exec(String(init?.body))?.[1]);
    return Response.json([
      {
        id,
        name: `IGDB ${id}`,
        cover: { url: `//images.igdb.com/igdb/image/upload/t_thumb/c${id}.jpg` },
        screenshots: [{ url: `//images.igdb.com/igdb/image/upload/t_thumb/s${id}.jpg` }],
        genres: [{ name: 'Indie' }],
        external_games: [{ external_game_source: 1, uid: String(id - 100_000) }],
      },
    ]);
  }
  if (url.startsWith('https://www.steamgriddb.com/api/v2/games/steam/')) {
    return Response.json({ data: { id: 7 } });
  }
  const steamApp = /\/steam\/apps\/(\d+)\//.exec(url)?.[1];
  if (steamApp && MISSING_STEAM_ART.has(Number(steamApp)))
    return new Response('gone', { status: 404 });
  const shade = [...url].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 200;
  return new Response(new Uint8Array(await solidImage(8, 8, 'webp', { r: shade, g: 40, b: 90 })));
}

beforeAll(async () => {
  vi.stubGlobal('fetch', network);
  miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response(null); } };',
    d1Databases: { DB: 'metrack-steam-budget' },
    r2Buckets: ['IMAGES'],
  });
  const DB = await miniflare.getD1Database('DB');
  rawDb = DB as unknown as D1Database;
  const IMAGES = await miniflare.getR2Bucket('IMAGES');
  await DB.batch(
    [
      ...D1_SCHEMA,
      D1_OWNER,
      `INSERT INTO api_token (user_id, name, secret_hash, scope, created_at) VALUES (1, 'test', '${hashSecret(SECRET)}', 'write', '2026-01-01T00:00:00.000Z')`,
      `INSERT INTO user_setting (user_id, steam_id) VALUES (1, '${STEAM_ID}')`,
    ].map((sql) => DB.prepare(sql)),
  );
  app = createWorkerApp({
    DB: counter.database(DB as never),
    IMAGES: counter.bucket(IMAGES as never),
    IMAGE_ENCODED_BY: 'client',
    IGDB_CLIENT_ID: 'id',
    IGDB_CLIENT_SECRET: 'secret',
    STEAM_API_KEY: 'steam-key',
    STEAMGRIDDB_TOKEN: 'sgdb',
  } as unknown as WorkerEnv);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await miniflare.dispose();
});

afterEach(() => counter.reset());

async function apply(appIds: number[]): Promise<Response> {
  return await app.request('http://localhost/api/steam/apply', {
    method: 'POST',
    headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
    body: JSON.stringify({ appIds: appIds.map(String) }),
  });
}

interface Outcome {
  appId: string;
  result: string;
}

async function run(appIds: number[]): Promise<{ outcomes: Outcome[]; subrequests: number }> {
  counter.reset();
  const response = await apply(appIds);
  expect(response.status).toBe(200);
  const outcomes = ((await response.json()) as { outcomes: Outcome[] }).outcomes;
  return { outcomes, subrequests: counter.total };
}

const ARTWORK_ROUTE_OVERHEAD = 5;

async function artwork(): Promise<{
  body: { processed: number; remaining: number };
  subrequests: number;
}> {
  counter.reset();
  const response = await app.request('http://localhost/api/steam/artwork', {
    method: 'POST',
    headers: { authorization: `Bearer ${SECRET}` },
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { processed: number; remaining: number };
  return { body, subrequests: counter.total };
}

async function pendingRows(): Promise<Record<string, unknown>[]> {
  const { results } = await rawDb
    .prepare(
      'SELECT id, steam_appid, cover, banner, steamgriddb_id FROM videogame WHERE artwork_pending = 1 ORDER BY id',
    )
    .all();
  return results as Record<string, unknown>[];
}

async function importAndPrepare(appId: number): Promise<number> {
  const imported = await run([appId]);
  expect(imported.outcomes.map((outcome) => outcome.result)).toEqual(['imported']);
  const { body, subrequests } = await artwork();
  expect(body).toEqual({ processed: 1, remaining: 0 });
  return subrequests - ARTWORK_ROUTE_OVERHEAD;
}

const appIdsOf = (from: number, to: number) => GAMES.slice(from, to).map((game) => game.appid);
const IGDB_GAMES = appIdsOf(0, 20);
const UPDATE_GAMES = appIdsOf(20, 30);
const CATALOG_GAMES = appIdsOf(30, 40);

describe('Steam import against the Workers free plan subrequest limit', () => {
  beforeAll(async () => {
    const statements = [
      "INSERT INTO user (id, name, role, created_at) VALUES (2, 'Other', 'normal', '2026-01-01T00:00:00.000Z')",
      ...UPDATE_GAMES.flatMap((appId, index) => [
        `INSERT INTO videogame (id, igdb_id, steam_appid, title) VALUES (${100 + index}, ${5000 + index}, '${appId}', 'Own ${appId}')`,
        `INSERT INTO videogame_entry (user_id, videogame_id, status, time_spent_minutes) VALUES (1, ${100 + index}, 'paused', 1)`,
      ]),
      ...CATALOG_GAMES.flatMap((appId, index) => [
        `INSERT INTO videogame (id, igdb_id, steam_appid, title) VALUES (${200 + index}, ${6000 + index}, '${appId}', 'Shared ${appId}')`,
        `INSERT INTO videogame_entry (user_id, videogame_id, status) VALUES (2, ${200 + index}, 'completed')`,
      ]),
    ];
    await rawDb.batch(statements.map((sql) => rawDb.prepare(sql)));
  });

  it('measures the fixed cost of a request that writes nothing', async () => {
    const { subrequests } = await run([99_999]);
    expect(subrequests).toBeLessThanOrEqual(STEAM_APPLY_BUDGET.overhead);
  });

  it('keeps each kind of game within its budgeted cost', async () => {
    const igdb = await run(IGDB_GAMES.slice(0, 1));
    const igdbOne = await run(IGDB_GAMES.slice(11, 12));
    const igdbTwo = await run(IGDB_GAMES.slice(12, 14));
    const marginal = igdbTwo.subrequests - igdbOne.subrequests;
    expect(
      marginal,
      `one game ${igdbOne.subrequests}, two games ${igdbTwo.subrequests}`,
    ).toBeLessThanOrEqual(STEAM_APPLY_BUDGET.igdb);
    const update = await run(UPDATE_GAMES.slice(0, 1));
    const catalog = await run(CATALOG_GAMES.slice(0, 1));
    expect([igdb, update, catalog].map((r) => r.outcomes[0]?.result)).toEqual([
      'imported',
      'updated',
      'imported',
    ]);
    const note = `igdb ${igdb.subrequests}, update ${update.subrequests}, catalog ${catalog.subrequests}`;
    expect(igdb.subrequests, note).toBeLessThanOrEqual(
      STEAM_APPLY_BUDGET.overhead + STEAM_APPLY_BUDGET.igdb,
    );
    expect(update.subrequests, note).toBeLessThanOrEqual(
      STEAM_APPLY_BUDGET.overhead + STEAM_APPLY_BUDGET.update,
    );
    expect(catalog.subrequests, note).toBeLessThanOrEqual(
      STEAM_APPLY_BUDGET.overhead + STEAM_APPLY_BUDGET.catalog,
    );
  });

  it('defers the games of a batch of new IGDB games that do not fit, and finishes them on the next requests', async () => {
    let pending = IGDB_GAMES.slice(1, 1 + STEAM_APPLY_BATCH_SIZE);
    const sizes: number[] = [];
    const imported = new Set<string>();
    while (pending.length > 0) {
      const { outcomes, subrequests } = await run(pending);
      expect(subrequests).toBeLessThanOrEqual(FREE_PLAN_SUBREQUESTS);
      sizes.push(outcomes.filter((outcome) => outcome.result !== 'deferred').length);
      for (const outcome of outcomes) {
        if (outcome.result === 'imported') imported.add(outcome.appId);
      }
      pending = outcomes.filter((o) => o.result === 'deferred').map((o) => Number(o.appId));
    }
    expect(imported.size).toBe(STEAM_APPLY_BATCH_SIZE);
    expect(sizes[0], `games per request: ${sizes.join(', ')}`).toBeGreaterThanOrEqual(7);
  });

  it('stores the imported games with linked artwork and marks them as waiting for it', async () => {
    const rows = await pendingRows();
    const all = await rawDb
      .prepare('SELECT COUNT(*) AS n FROM videogame WHERE igdb_id >= 100000')
      .first();
    expect(rows.length).toBe(Number(all?.n));
    expect(rows.length).toBeGreaterThanOrEqual(1 + STEAM_APPLY_BATCH_SIZE);
    expect(rows.every((row) => String(row.cover).includes('steamstatic.com'))).toBe(true);
    expect(rows.every((row) => row.steamgriddb_id === null)).toBe(true);
  });

  it(
    'prepares the artwork of the imported games on request without passing the limit',
    { timeout: 60_000 },
    async () => {
      const idle = await artwork();
      expect(idle.body.processed).toBeGreaterThan(0);
      const measured: string[] = [`first ${idle.subrequests}`];
      let remaining = idle.body.remaining;
      expect(idle.subrequests).toBeLessThanOrEqual(FREE_PLAN_SUBREQUESTS);
      while (remaining > 0) {
        const next = await artwork();
        measured.push(`${next.body.processed} games ${next.subrequests}`);
        expect(next.subrequests, measured.join(', ')).toBeLessThanOrEqual(FREE_PLAN_SUBREQUESTS);
        expect(next.body.processed).toBeGreaterThan(0);
        remaining = next.body.remaining;
      }
      expect(await pendingRows()).toHaveLength(0);
      const finished = await rawDb
        .prepare(
          'SELECT steam_appid, cover, banner, steamgriddb_id FROM videogame WHERE igdb_id >= 100000 ORDER BY id',
        )
        .all();
      for (const row of finished.results as Record<string, unknown>[]) {
        expect(row.steamgriddb_id).toBe(7);
        const missing = MISSING_STEAM_ART.has(Number(row.steam_appid));
        expect(String(row.cover).includes('images.igdb.com')).toBe(missing);
        expect(String(row.banner).includes('images.igdb.com')).toBe(missing);
      }
    },
  );

  it('measures the fixed cost of an artwork request with nothing to prepare', async () => {
    const idle = await artwork();
    expect(idle.body).toEqual({ processed: 0, remaining: 0 });
    expect(idle.subrequests).toBeLessThanOrEqual(ARTWORK_ROUTE_OVERHEAD);
  });

  it('costs no more than budgeted for one game, with Steam art and with the IGDB fallback', async () => {
    const linked = await importAndPrepare(1018);
    const fallback = await importAndPrepare(1019);
    const note = `linked ${linked}, fallback ${fallback}`;
    expect(linked, note).toBeLessThanOrEqual(GAME_ARTWORK_COST.linked);
    expect(fallback, note).toBeLessThanOrEqual(GAME_ARTWORK_COST.fallback);
  });

  it('raises the time of a full batch of games in one request', async () => {
    const { outcomes, subrequests } = await run(UPDATE_GAMES.slice(1));
    expect(outcomes.map((o) => o.result)).toEqual(UPDATE_GAMES.slice(1).map(() => 'updated'));
    expect(subrequests).toBeLessThanOrEqual(FREE_PLAN_SUBREQUESTS);
  });

  it('adds a full batch of games the catalog already has in one request', async () => {
    const { outcomes, subrequests } = await run(CATALOG_GAMES.slice(1));
    expect(outcomes.map((o) => o.result)).toEqual(CATALOG_GAMES.slice(1).map(() => 'imported'));
    expect(subrequests).toBeLessThanOrEqual(FREE_PLAN_SUBREQUESTS);
  });
});
