import { beforeEach, describe, expect, it } from 'vitest';
import type { FetchFn } from '../src/http/FetchFn.js';
import { SqliteUserSettingsRepository } from '../src/storage/sqlite/SqliteUserSettingsRepository.js';
import { SqliteVideogameRepository } from '../src/storage/sqlite/SqliteVideogameRepository.js';
import type { SteamAchievementsService } from '../src/steam/SteamAchievementsService.js';
import { createSteamServices } from '../src/steam/createSteamServices.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';

const STEAM_ID = '76561198012345678';
const SCHEMA = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/';
const PLAYER = 'https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/';
const UNLOCK = 1_700_000_000;

type Answer = { status: number; body: unknown };

const schema = {
  game: {
    availableGameStats: {
      achievements: [
        { name: 'A', displayName: 'First', description: 'Do it', icon: 'i-a', icongray: 'g-a' },
        {
          name: 'B',
          displayName: 'Secret',
          hidden: 1,
          description: 'Spoiler',
          icon: 'i-b',
          icongray: 'g-b',
        },
        { name: 'C', displayName: 'Third', description: 'Again', icon: 'i-c', icongray: 'g-c' },
      ],
    },
  },
};

const player = (flags: boolean[]) => ({
  playerstats: {
    success: true,
    achievements: ['A', 'B', 'C'].slice(0, flags.length).map((apiname, index) => ({
      apiname,
      achieved: flags[index] ? 1 : 0,
      unlocktime: flags[index] ? UNLOCK + index : 0,
    })),
  },
});

let api: TestApi;
let service: SteamAchievementsService;
let calls: URL[];
let schemaAnswer: Answer;
let playerAnswers: Record<string, Answer>;

const network = (async (input: string | URL | Request) => {
  const target = new URL(input instanceof Request ? input.url : input.toString());
  const base = `${target.origin}${target.pathname}`;
  calls.push(target);
  if (base === SCHEMA) return Response.json(schemaAnswer.body, { status: schemaAnswer.status });
  if (base === PLAYER) {
    const answer = playerAnswers[target.searchParams.get('appid') ?? ''];
    return Response.json(answer?.body ?? {}, { status: answer?.status ?? 500 });
  }
  return new Response('x', { status: 404 });
}) as FetchFn;

beforeEach(async () => {
  calls = [];
  schemaAnswer = { status: 200, body: schema };
  playerAnswers = {
    '10': { status: 200, body: player([true, false, true]) },
    '20': { status: 200, body: player([false, false, false]) },
    '30': {
      status: 400,
      body: { playerstats: { error: 'Requested app has no stats', success: false } },
    },
    '50': {
      status: 403,
      body: { playerstats: { error: 'Profile is not public', success: false } },
    },
  };
  api = await createTestApi(network, {
    extend: ({ db, scope }) => {
      const steam = createSteamServices(
        'steam-key',
        network,
        new SqliteVideogameRepository(db, scope),
        new SqliteUserSettingsRepository(db),
        undefined,
      );
      service = steam.achievements as SteamAchievementsService;
      return { steamAchievements: steam.achievements };
    },
  });
  for (const [id, appId] of [
    [1, '10'],
    [2, '20'],
    [3, '30'],
    [5, '50'],
    [7, null],
  ] as const) {
    api.db.exec(
      `INSERT INTO videogame (id, igdb_id, steam_appid, title) VALUES (${id}, ${2000 + id}, ${appId === null ? 'NULL' : `'${appId}'`}, 'Game ${id}')`,
    );
    api.db.exec(
      `INSERT INTO videogame_entry (user_id, videogame_id, status) VALUES (1, ${id}, 'paused')`,
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

const link = () =>
  api.app.inject({ method: 'PATCH', url: '/api/settings', payload: { steamId: STEAM_ID } });
const get = (id: number, query = '') =>
  api.app.inject({ method: 'GET', url: `/api/steam/achievements/${id}${query}` });
const game = async (id: number) =>
  (await api.app.inject({ method: 'GET', url: `/api/games/${id}` })).json();

describe('GET /api/steam/achievements/:gameId', () => {
  it('needs a linked Steam account', async () => {
    const response = await get(1);
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('steam_id_missing');
  });

  it('merges schema and unlocks, hides locked secrets and stores the counts', async () => {
    await link();
    const response = await get(1);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      state: 'ok',
      unlocked: 2,
      total: 3,
      achievements: [
        {
          apiName: 'C',
          name: 'Third',
          description: 'Again',
          hidden: false,
          iconUrl: 'i-c',
          unlocked: true,
          unlockedAt: new Date((UNLOCK + 2) * 1000).toISOString(),
        },
        {
          apiName: 'A',
          name: 'First',
          description: 'Do it',
          hidden: false,
          iconUrl: 'i-a',
          unlocked: true,
          unlockedAt: new Date(UNLOCK * 1000).toISOString(),
        },
        {
          apiName: 'B',
          name: 'Secret',
          description: null,
          hidden: true,
          iconUrl: 'g-b',
          unlocked: false,
          unlockedAt: null,
        },
      ],
    });
    expect(await game(1)).toMatchObject({
      achievementsUnlocked: 2,
      achievementsTotal: 3,
      achievementsLastUnlockedAt: new Date((UNLOCK + 2) * 1000).toISOString().slice(0, 10),
    });
    expect((await game(1)).achievementsCheckedAt).not.toBeNull();
  });

  it('maps the user language to the Steam language and lets the query override it', async () => {
    await link();
    await get(1);
    expect(calls.map((url) => url.searchParams.get('l'))).toEqual(['english', 'english']);
    calls.length = 0;
    await api.app.inject({ method: 'PATCH', url: '/api/settings', payload: { language: 'es' } });
    await get(1);
    expect(calls.map((url) => url.searchParams.get('l'))).toEqual(['spanish', 'spanish']);
    calls.length = 0;
    await get(1, '?language=en');
    expect(calls.map((url) => url.searchParams.get('l'))).toEqual(['english', 'english']);
  });

  it('answers none for a game without stats and stores a total of 0', async () => {
    await link();
    const response = await get(3);
    expect(response.json()).toMatchObject({ state: 'none', total: 0, achievements: [] });
    expect(await game(3)).toMatchObject({ achievementsUnlocked: 0, achievementsTotal: 0 });
  });

  it('answers private for a profile Steam refuses and keeps the counts', async () => {
    await link();
    const response = await get(5);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ state: 'private', achievements: [] });
    const stored = await game(5);
    expect(stored).toMatchObject({ achievementsUnlocked: null, achievementsTotal: null });
    expect(stored.achievementsCheckedAt).not.toBeNull();
  });

  it('answers unavailable when the schema cannot be read', async () => {
    await link();
    schemaAnswer = { status: 500, body: {} };
    const response = await get(1);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      state: 'unavailable',
      unlocked: 2,
      total: 3,
      achievements: [],
    });
    expect(await game(1)).toMatchObject({ achievementsUnlocked: 2, achievementsTotal: 3 });
  });

  it('refuses games without a Steam app id and games of other users', async () => {
    await link();
    expect((await get(7)).statusCode).toBe(404);
    expect((await get(8)).statusCode).toBe(404);
    expect((await get(99)).statusCode).toBe(404);
  });

  it('writes nothing for a read-only caller', async () => {
    await link();
    const detail = await service.details(1, 1, { readOnly: true });
    expect(detail).toMatchObject({ state: 'ok', unlocked: 2, total: 3 });
    expect(await game(1)).toMatchObject({
      achievementsUnlocked: null,
      achievementsCheckedAt: null,
    });
  });
});
