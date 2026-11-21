import { beforeEach, describe, expect, it } from 'vitest';
import type { FetchFn } from '../src/http/FetchFn.js';
import { SqliteUserSettingsRepository } from '../src/storage/sqlite/SqliteUserSettingsRepository.js';
import { SqliteVideogameRepository } from '../src/storage/sqlite/SqliteVideogameRepository.js';
import { createSteamServices } from '../src/steam/createSteamServices.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';

const STEAM_ID = '76561198012345678';
const ACHIEVEMENTS = 'https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/';
const UNLOCK = 1_700_000_000;

type Answer = { status: number; body: unknown };

const list = (flags: boolean[], times: number[] = []) => ({
  playerstats: {
    success: true,
    achievements: flags.map((achieved, index) => ({
      apiname: `A${index}`,
      achieved: achieved ? 1 : 0,
      unlocktime: achieved ? (times[index] ?? UNLOCK) : 0,
    })),
  },
});

const answers: Record<string, Answer> = {
  '10': { status: 200, body: list([true, true, true, false, false], [100, UNLOCK, 300]) },
  '20': { status: 200, body: list([true, true]) },
  '30': {
    status: 400,
    body: { playerstats: { error: 'Requested app has no stats', success: false } },
  },
  '40': { status: 200, body: { playerstats: { success: true } } },
  '50': { status: 403, body: { playerstats: { error: 'Profile is not public', success: false } } },
  '60': { status: 200, body: list([false, false, false]) },
};

let api: TestApi;
let calls: URL[];
let overrides: Record<string, Answer>;

const network = (async (input: string | URL | Request) => {
  const target = new URL(input instanceof Request ? input.url : input.toString());
  if (`${target.origin}${target.pathname}` !== ACHIEVEMENTS)
    return new Response('x', { status: 404 });
  calls.push(target);
  const answer = overrides[target.searchParams.get('appid') ?? ''] ?? { status: 500, body: {} };
  return Response.json(answer.body, { status: answer.status });
}) as FetchFn;

beforeEach(async () => {
  calls = [];
  overrides = { ...answers };
  api = await createTestApi(network, {
    extend: ({ db, scope }) => {
      const steam = createSteamServices(
        'steam-key',
        network,
        new SqliteVideogameRepository(db, scope),
        new SqliteUserSettingsRepository(db),
        undefined,
      );
      return { steamAchievements: steam.achievements };
    },
  });
  const rows: [number, string | null, number | null][] = [
    [1, '10', 120],
    [2, '20', 30],
    [3, '30', 10],
    [4, '40', null],
    [5, '50', 5],
    [6, '60', 500],
    [7, null, 90],
  ];
  for (const [id, appId, minutes] of rows) {
    api.db.exec(
      `INSERT INTO videogame (id, igdb_id, steam_appid, title) VALUES (${id}, ${2000 + id}, ${appId === null ? 'NULL' : `'${appId}'`}, 'Game ${id}')`,
    );
    api.db.exec(
      `INSERT INTO videogame_entry (user_id, videogame_id, status, time_spent_minutes) VALUES (1, ${id}, 'paused', ${minutes ?? 'NULL'})`,
    );
  }
  api.db.exec(
    "INSERT INTO user (id, name, role, created_at) VALUES (2, 'Other', 'normal', '2026-01-01T00:00:00.000Z')",
  );
  api.db.exec(
    "INSERT INTO videogame (id, igdb_id, steam_appid, title) VALUES (8, 2008, '70', 'Theirs')",
  );
  api.db.exec(
    "INSERT INTO videogame_entry (user_id, videogame_id, status) VALUES (2, 8, 'planned')",
  );
});

const post = (payload: object = {}) =>
  api.app.inject({ method: 'POST', url: '/api/steam/achievements', payload });
const link = () =>
  api.app.inject({ method: 'PATCH', url: '/api/settings', payload: { steamId: STEAM_ID } });
const game = async (id: number) =>
  (await api.app.inject({ method: 'GET', url: `/api/games/${id}` })).json();

describe('POST /api/steam/achievements', () => {
  it('needs a linked Steam account', async () => {
    const response = await post();
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('steam_id_missing');
  });

  it('classifies partial, complete, none, failed and unknown games', async () => {
    await link();
    const response = await post();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ processed: 6, failed: 1, remaining: 0 });
    expect(await game(1)).toMatchObject({
      achievementsUnlocked: 3,
      achievementsTotal: 5,
      achievementsLastUnlockedAt: new Date(UNLOCK * 1000).toISOString().slice(0, 10),
    });
    expect(await game(2)).toMatchObject({ achievementsUnlocked: 2, achievementsTotal: 2 });
    expect(await game(3)).toMatchObject({ achievementsUnlocked: 0, achievementsTotal: 0 });
    expect(await game(4)).toMatchObject({ achievementsUnlocked: 0, achievementsTotal: 0 });
    expect(await game(6)).toMatchObject({
      achievementsUnlocked: 0,
      achievementsTotal: 3,
      achievementsLastUnlockedAt: null,
    });
    const failed = await game(5);
    expect(failed).toMatchObject({ achievementsUnlocked: null, achievementsTotal: null });
    expect(failed.achievementsCheckedAt).not.toBeNull();
    expect((await game(7)).achievementsCheckedAt).toBeNull();
  });

  it('asks Steam only for the caller games that have a Steam app id, played games first', async () => {
    await link();
    await post();
    const asked = calls.map((url) => url.searchParams.get('appid'));
    expect(asked.slice(0, 5)).toEqual(['10', '20', '30', '50', '60']);
    expect(asked[5]).toBe('40');
    expect([...asked].sort()).toEqual(['10', '20', '30', '40', '50', '60']);
    expect(calls.every((url) => url.searchParams.get('steamid') === STEAM_ID)).toBe(true);
  });

  it('keeps the previous counts when Steam fails later and never marks them complete', async () => {
    await link();
    const first = (await post()).json();
    overrides['10'] = { status: 500, body: {} };
    const second = await post({ asOf: new Date(Date.parse(first.asOf) + 60_000).toISOString() });
    expect(second.json().failed).toBe(2);
    expect(await game(1)).toMatchObject({ achievementsUnlocked: 3, achievementsTotal: 5 });
  });

  it('checks one game by id and refuses games that are not eligible', async () => {
    await link();
    const response = await post({ gameId: 2 });
    expect(response.json()).toMatchObject({ processed: 1, failed: 0, remaining: 0 });
    expect(calls).toHaveLength(1);
    expect((await post({ gameId: 7 })).statusCode).toBe(404);
    expect((await post({ gameId: 8 })).statusCode).toBe(404);
  });

  it('rejects an invalid body and a bad asOf', async () => {
    await link();
    expect((await post({ gameId: 'x' })).statusCode).toBe(400);
    expect((await post({ asOf: 'yesterday' })).json().code).toBe('invalid_as_of');
  });

  it('answers 501 without a Steam API key', async () => {
    const bare = await createTestApi(network);
    const response = await bare.app.inject({
      method: 'POST',
      url: '/api/steam/achievements',
      payload: {},
    });
    expect(response.statusCode).toBe(501);
  });
});
