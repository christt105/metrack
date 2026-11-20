import { beforeEach, describe, expect, it } from 'vitest';
import type { FetchFn } from '../src/http/FetchFn.js';
import { IgdbClient } from '../src/providers/igdb/IgdbClient.js';
import { SqlitePublicProfileRepository } from '../src/storage/sqlite/SqlitePublicProfileRepository.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { SqliteUserSettingsRepository } from '../src/storage/sqlite/SqliteUserSettingsRepository.js';
import { SqliteVideogameRepository } from '../src/storage/sqlite/SqliteVideogameRepository.js';
import { createSteamServices } from '../src/steam/createSteamServices.js';
import { IgdbGameProvider } from '../src/titles/IgdbGameProvider.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { png } from './support/sampleImages.js';

const STEAM_ID = '76561198012345678';
const OWNED = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';
const VANITY = 'https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/';

interface Owned {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks?: number;
  rtime_last_played?: number;
}

const owned: Owned[] = [
  { appid: 10, name: 'Library Raise', playtime_forever: 500, rtime_last_played: 1_700_000_000 },
  { appid: 20, name: 'Library Higher', playtime_forever: 600 },
  { appid: 30, name: 'Library Never Played', playtime_forever: 0 },
  { appid: 40, name: 'Catalog Game', playtime_forever: 300, playtime_2weeks: 20 },
  { appid: 50, name: 'Igdb Recent', playtime_forever: 120, playtime_2weeks: 15 },
  { appid: 60, name: 'Unknown Game', playtime_forever: 70 },
  { appid: 70, name: 'Igdb Never Played', playtime_forever: 0 },
  { appid: 80, name: 'Igdb Old', playtime_forever: 45 },
];

const igdbIds: Record<string, number> = { '50': 5000, '70': 7000, '80': 8000 };

interface Net {
  fetch: FetchFn;
  calls: string[];
  state: { owned: Owned[] | null; steamStatus: number; igdbDown: boolean; failGame: number | null };
}

function network(): Net {
  const calls: string[] = [];
  const state: Net['state'] = { owned, steamStatus: 200, igdbDown: false, failGame: null };
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const target = new URL(input instanceof Request ? input.url : input.toString());
    const url = `${target.origin}${target.pathname}`;
    calls.push(url);
    if (url === OWNED) {
      if (state.steamStatus !== 200) return new Response('no', { status: state.steamStatus });
      return Response.json({
        response: state.owned ? { game_count: state.owned.length, games: state.owned } : {},
      });
    }
    if (url === VANITY) {
      return Response.json({
        response:
          target.searchParams.get('vanityurl') === 'gaben'
            ? { success: 1, steamid: STEAM_ID }
            : { success: 42 },
      });
    }
    if (url === 'https://id.twitch.tv/oauth2/token') {
      return Response.json({ access_token: 't', expires_in: 3600 });
    }
    if (url === 'https://api.igdb.com/v4/external_games') {
      if (state.igdbDown) return new Response('down', { status: 500 });
      const uids = [...String(init?.body).matchAll(/"(\d+)"/g)].map((m) => m[1] ?? '');
      return Response.json(
        uids.flatMap((uid) => (igdbIds[uid] ? [{ id: 1, uid, game: igdbIds[uid] }] : [])),
      );
    }
    if (url === 'https://api.igdb.com/v4/games') {
      const id = Number(/where id = (\d+);/.exec(String(init?.body))?.[1]);
      if (id === state.failGame) return new Response('boom', { status: 500 });
      const uid = Object.entries(igdbIds).find(([, game]) => game === id)?.[0];
      return Response.json([
        {
          id,
          name: `IGDB ${id}`,
          external_games: [{ external_game_source: 1, uid }],
        },
      ]);
    }
    if (url.startsWith('https://cdn.cloudflare.steamstatic.com/')) {
      return new Response(new Uint8Array(png(8, 8)));
    }
    return new Response('missing', { status: 404 });
  }) as FetchFn;
  return { fetch: fetchFn, calls, state };
}

let net: Net;
let api: TestApi;

async function build(options: { steam?: boolean } = {}): Promise<void> {
  net = network();
  api = await createTestApi(net.fetch, {
    extend: ({ db, scope, store }) => {
      const videogames = new SqliteVideogameRepository(db, scope);
      const settings = new SqliteUserSettingsRepository(db);
      const client = new IgdbClient(net.fetch, { clientId: 'c', clientSecret: 's' });
      const provider = new IgdbGameProvider(client, videogames, store, null);
      const steam = createSteamServices(
        options.steam === false ? undefined : 'steam-key',
        net.fetch,
        videogames,
        settings,
        { client, adder: provider },
      );
      return {
        steam: steam.importer,
        settings: {
          users: new SqliteUserRepository(db),
          settings,
          profiles: new SqlitePublicProfileRepository(db),
          steamIds: steam.ids,
        },
      };
    },
  });
}

const get = (url: string) => api.app.inject({ method: 'GET', url });
const post = (url: string, payload: object) => api.app.inject({ method: 'POST', url, payload });
const patch = (url: string, payload: object) => api.app.inject({ method: 'PATCH', url, payload });

async function link(): Promise<void> {
  expect((await patch('/api/settings', { steamId: STEAM_ID })).statusCode).toBe(200);
}

function seedLibrary(): void {
  const insert = (sql: string) => api.db.exec(sql);
  insert(
    "INSERT INTO videogame (id, igdb_id, steam_appid, title) VALUES (1, 1001, '10', 'Library Raise')",
  );
  insert(
    "INSERT INTO videogame_entry (user_id, videogame_id, status, time_spent_minutes) VALUES (1, 1, 'paused', 100)",
  );
  insert(
    "INSERT INTO videogame (id, igdb_id, steam_appid, title) VALUES (2, 1002, '20', 'Library Higher')",
  );
  insert(
    "INSERT INTO videogame_entry (user_id, videogame_id, status, time_spent_minutes) VALUES (1, 2, 'paused', 900)",
  );
  insert(
    "INSERT INTO videogame (id, igdb_id, steam_appid, title) VALUES (3, 1003, '30', 'Library Never Played')",
  );
  insert("INSERT INTO videogame_entry (user_id, videogame_id, status) VALUES (1, 3, 'planned')");
  insert(
    "INSERT INTO user (id, name, role, created_at) VALUES (2, 'Other', 'normal', '2026-01-01T00:00:00.000Z')",
  );
  insert(
    "INSERT INTO videogame (id, igdb_id, steam_appid, title) VALUES (4, 1004, '40', 'Catalog Game')",
  );
  insert("INSERT INTO videogame_entry (user_id, videogame_id, status) VALUES (2, 4, 'completed')");
}

beforeEach(async () => {
  await build();
  seedLibrary();
});

describe('linking a Steam account', () => {
  it('stores the SteamID64 from an id, a profile address or a vanity name, and clears it', async () => {
    for (const steamId of [
      STEAM_ID,
      `https://steamcommunity.com/profiles/${STEAM_ID}`,
      'https://steamcommunity.com/id/gaben',
      'gaben',
    ]) {
      const response = await patch('/api/settings', { steamId });
      expect(response.json().steamId).toBe(STEAM_ID);
    }
    expect((await get('/api/settings')).json().settings.steamId).toBe(STEAM_ID);
    expect((await patch('/api/settings', { steamId: null })).json().steamId).toBeNull();
    await patch('/api/settings', { steamId: STEAM_ID });
    expect((await patch('/api/settings', { steamId: '  ' })).json().steamId).toBeNull();
  });

  it('refuses a vanity name Steam does not know and text that is no profile', async () => {
    expect((await patch('/api/settings', { steamId: 'nobody' })).json().code).toBe(
      'steam_profile_not_found',
    );
    expect((await patch('/api/settings', { steamId: 'two words' })).statusCode).toBe(400);
  });

  it('keeps the language when only the Steam account changes, and the other way round', async () => {
    await patch('/api/settings', { language: 'en' });
    await patch('/api/settings', { steamId: STEAM_ID });
    expect((await patch('/api/settings', { language: 'es' })).json()).toMatchObject({
      language: 'es',
      steamId: STEAM_ID,
    });
    expect((await patch('/api/settings', {})).statusCode).toBe(400);
  });

  it('shows the feature in the health report only when the server can import', async () => {
    expect((await get('/api/health')).json().features.steam).toBe(true);
    await build({ steam: false });
    expect((await get('/api/health')).json().features.steam).toBe(false);
  });
});

describe('GET /api/steam/report', () => {
  it('needs a linked Steam account', async () => {
    const response = await get('/api/steam/report');
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('steam_id_missing');
  });

  it('answers 501 when Steam is not configured', async () => {
    await build({ steam: false });
    expect((await get('/api/steam/report')).statusCode).toBe(501);
    expect((await post('/api/steam/apply', { appIds: ['10'] })).statusCode).toBe(501);
  });

  it('sorts the owned games into updates, imports and unmatched, writing nothing', async () => {
    await link();
    const before = api.db.prepare('SELECT COUNT(*) AS n FROM videogame_entry').get()?.n;
    const response = await get('/api/steam/report');
    expect(response.statusCode).toBe(200);
    const report = response.json();
    expect(report).toMatchObject({ steamId: STEAM_ID, owned: 8, upToDate: 2 });
    const rows = Object.fromEntries(report.rows.map((row: { appId: string }) => [row.appId, row]));
    expect(Object.keys(rows).sort()).toEqual(['10', '40', '50', '70', '80']);
    expect(rows['10']).toMatchObject({
      action: 'update',
      storedMinutes: 100,
      playtimeMinutes: 500,
      lastPlayedAt: '2023-11-14T22:13:20.000Z',
    });
    expect(rows['40']).toMatchObject({ source: 'catalog', status: 'in_progress', selected: true });
    expect(rows['50']).toMatchObject({ source: 'igdb', status: 'in_progress' });
    expect(rows['80']).toMatchObject({ source: 'igdb', status: 'paused' });
    expect(rows['70']).toMatchObject({ source: 'igdb', status: 'planned', selected: false });
    expect(report.unmatched).toEqual([{ appId: '60', name: 'Unknown Game', playtimeMinutes: 70 }]);
    expect(api.db.prepare('SELECT COUNT(*) AS n FROM videogame_entry').get()?.n).toBe(before);
    expect(net.calls.filter((url) => url.endsWith('/GetOwnedGames/v1/'))).toHaveLength(1);
    expect(net.calls.filter((url) => url.endsWith('/external_games'))).toHaveLength(1);
  });

  it('says exactly that the profile or its game details are private when Steam returns nothing', async () => {
    await link();
    net.state.owned = null;
    const response = await get('/api/steam/report');
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe('steam_profile_private');
    expect(response.json().error).toContain('private');
  });

  it('reports a rejected key and an unreachable Steam without leaking the key', async () => {
    await link();
    net.state.steamStatus = 403;
    const rejected = await get('/api/steam/report');
    expect(rejected.json().code).toBe('steam_key_rejected');
    net.state.steamStatus = 500;
    const down = await get('/api/steam/report');
    expect(down.json().code).toBe('steam_unavailable');
    expect(rejected.body + down.body).not.toContain('steam-key');
  });
});

describe('POST /api/steam/apply', () => {
  const entries = () =>
    api.db
      .prepare(
        `SELECT v.steam_appid AS app, e.status, e.time_spent_minutes AS minutes, e.started_at, e.finished_at
           FROM videogame_entry e JOIN videogame v ON v.id = e.videogame_id
          WHERE e.user_id = 1 ORDER BY v.steam_appid`,
      )
      .all();

  it('updates the time, imports from the catalog and from IGDB, and defers what does not fit the budget', async () => {
    await link();
    const response = await post('/api/steam/apply', { appIds: ['10', '40', '50', '70', '60'] });
    expect(response.statusCode).toBe(200);
    expect(response.json().outcomes).toEqual([
      { appId: '10', result: 'updated' },
      { appId: '40', result: 'imported' },
      { appId: '50', result: 'imported' },
      { appId: '70', result: 'deferred' },
      { appId: '60', result: 'skipped' },
    ]);
    const next = await post('/api/steam/apply', { appIds: ['70'] });
    expect(next.json().outcomes).toEqual([{ appId: '70', result: 'imported' }]);
    const stored = Object.fromEntries(entries().map((row) => [String(row.app), row]));
    expect(stored['10']).toMatchObject({ status: 'paused', minutes: 500 });
    expect(stored['40']).toMatchObject({
      status: 'in_progress',
      minutes: 300,
      started_at: null,
      finished_at: null,
    });
    expect(stored['50']).toMatchObject({ status: 'in_progress', minutes: 120, started_at: null });
    expect(stored['70']).toMatchObject({ status: 'planned', minutes: 0 });
    expect(stored['20']).toMatchObject({ minutes: 900 });
    expect(
      api.db.prepare("SELECT COUNT(*) AS n FROM videogame WHERE steam_appid = '40'").get()?.n,
    ).toBe(1);
  });

  it('is idempotent: repeating a batch adds nothing and changes nothing', async () => {
    await link();
    await post('/api/steam/apply', { appIds: ['10', '40', '50'] });
    const snapshot = JSON.stringify(entries());
    const again = await post('/api/steam/apply', { appIds: ['10', '40', '50'] });
    expect(again.json().outcomes.map((o: { result: string }) => o.result)).toEqual([
      'skipped',
      'skipped',
      'skipped',
    ]);
    expect(JSON.stringify(entries())).toBe(snapshot);
  });

  it('recomputes from Steam: ids it does not own or that are up to date are skipped, and time never goes down', async () => {
    await link();
    const response = await post('/api/steam/apply', { appIds: ['20', '30', '999', '20'] });
    expect(response.json().outcomes).toEqual([
      { appId: '20', result: 'skipped' },
      { appId: '30', result: 'skipped' },
      { appId: '999', result: 'skipped' },
    ]);
    expect(entries().find((row) => row.app === '20')?.minutes).toBe(900);
    net.state.owned = owned.map((g) => (g.appid === 10 ? { ...g, playtime_forever: 50 } : g));
    const lower = await post('/api/steam/apply', { appIds: ['10'] });
    expect(lower.json().outcomes).toEqual([{ appId: '10', result: 'skipped' }]);
    expect(entries().find((row) => row.app === '10')?.minutes).toBe(100);
  });

  it('records a failure for one game and still writes the rest', async () => {
    await link();
    net.state.failGame = 5000;
    const response = await post('/api/steam/apply', { appIds: ['50', '80'] });
    expect(response.json().outcomes).toMatchObject([
      { appId: '50', result: 'failed' },
      { appId: '80', result: 'imported' },
    ]);
    expect(entries().map((row) => String(row.app))).not.toContain('50');
  });

  it('refuses an empty list, a list over the batch size and ids that are not numbers', async () => {
    await link();
    expect((await post('/api/steam/apply', { appIds: [] })).statusCode).toBe(400);
    const tooMany = Array.from({ length: 11 }, (_, i) => String(i + 1));
    expect((await post('/api/steam/apply', { appIds: tooMany })).statusCode).toBe(400);
    expect((await post('/api/steam/apply', { appIds: ['abc'] })).statusCode).toBe(400);
  });
});
