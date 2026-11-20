import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameArtworkBackfill } from '../src/backfill/GameArtworkBackfill.js';
import { GameArtworkScheduler } from '../src/backfill/GameArtworkScheduler.js';
import type { FetchFn } from '../src/http/FetchFn.js';
import { createImageStore } from '../src/images/createImageStore.js';
import type { ImageStore } from '../src/images/ImageStore.js';
import { IgdbClient } from '../src/providers/igdb/IgdbClient.js';
import type { IgdbGame } from '../src/providers/igdb/IgdbGame.js';
import { SteamGridDbClient } from '../src/providers/steamgriddb/SteamGridDbClient.js';
import { SqliteGameArtworkRepository } from '../src/storage/sqlite/SqliteGameArtworkRepository.js';
import { SqliteVideogameRepository } from '../src/storage/sqlite/SqliteVideogameRepository.js';
import { IgdbGameProvider } from '../src/titles/IgdbGameProvider.js';
import { ScheduledTick } from '../src/worker/ScheduledTick.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { OWNER_SCOPE } from './support/ownerScope.js';
import { png } from './support/sampleImages.js';

const STEAM = 'https://cdn.cloudflare.steamstatic.com/steam/apps';
const IGDB_IMAGES = 'https://images.igdb.com/igdb/image/upload';

function game(id: number, steamUid: string | null): IgdbGame {
  return {
    id,
    name: `Game ${id}`,
    cover: { url: `//images.igdb.com/igdb/image/upload/t_thumb/co${id}.jpg` },
    screenshots: [{ url: `//images.igdb.com/igdb/image/upload/t_thumb/sc${id}.jpg` }],
    external_games: steamUid ? [{ external_game_source: 1, uid: steamUid }] : [],
  };
}

const catalog = [game(1, '11'), game(2, '22'), game(3, null), game(4, '44')];

let calls: string[];
let missing: Set<string>;
let igdbDown: boolean;
let db: DatabaseSync;
let provider: IgdbGameProvider;
let backfill: GameArtworkBackfill;
let artwork: SqliteGameArtworkRepository;
let games: SqliteVideogameRepository;
let images: ImageStore;
let errors: string[];

const logger = { info: () => {}, error: (message: string) => errors.push(message) };

beforeEach(() => {
  calls = [];
  errors = [];
  missing = new Set();
  igdbDown = false;
  const fetchFn = ((input: string | URL) => {
    const url = input.toString();
    calls.push(url);
    if (url.startsWith('https://id.twitch.tv')) {
      return Promise.resolve(Response.json({ access_token: 't', expires_in: 3600 }));
    }
    if (url === 'https://api.igdb.com/v4/games') {
      return Promise.resolve(Response.json([]));
    }
    if (url.startsWith('https://www.steamgriddb.com/api/v2/games/steam/')) {
      return Promise.resolve(Response.json({ data: { id: 900 + Number(url.split('/').at(-1)) } }));
    }
    if (missing.has(url)) return Promise.resolve(new Response('gone', { status: 404 }));
    return Promise.resolve(new Response(new Uint8Array(png(8, 8, calls.length))));
  }) as FetchFn;
  const igdbFetch = ((input: string | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url === 'https://api.igdb.com/v4/games') {
      if (igdbDown) return Promise.resolve(new Response('down', { status: 500 }));
      calls.push(url);
      const id = Number(/where id = (\d+);/.exec(String(init?.body))?.[1]);
      return Promise.resolve(Response.json(catalog.filter((g) => g.id === id)));
    }
    return fetchFn(input, init);
  }) as FetchFn;
  db = openTestDatabase();
  games = new SqliteVideogameRepository(db, OWNER_SCOPE);
  images = createImageStore(db, mkdtempSync(join(tmpdir(), 'metrack-artwork-')), igdbFetch);
  const client = new IgdbClient(igdbFetch, { clientId: 'c', clientSecret: 's' });
  const steamGridDb = new SteamGridDbClient(igdbFetch, 'sgdb');
  artwork = new SqliteGameArtworkRepository(db);
  provider = new IgdbGameProvider(client, games, images, steamGridDb, artwork);
  backfill = new GameArtworkBackfill(artwork, images, client, steamGridDb, logger);
});

const entry = { status: 'planned', timeSpentMinutes: 5 } as const;

async function flag(id: number): Promise<number> {
  return Number(db.prepare('SELECT artwork_pending AS v FROM videogame WHERE id = ?').get(id)?.v);
}

describe('adding a game with deferred artwork', () => {
  it('stores the linked Steam art, marks the game pending and fetches no image', async () => {
    const ref = await provider.addWithDeferredArtwork('1', entry);
    expect(await games.get(ref.id)).toMatchObject({
      igdbId: 1,
      steamAppId: '11',
      steamGridDbId: null,
      cover: `${STEAM}/11/library_600x900_2x.jpg`,
      banner: `${STEAM}/11/library_hero.jpg`,
      status: 'planned',
      timeSpentMinutes: 5,
    });
    expect(await flag(ref.id)).toBe(1);
    expect(calls.filter((url) => !url.startsWith('https://api.igdb.com'))).toEqual([
      'https://id.twitch.tv/oauth2/token?client_id=c&client_secret=s&grant_type=client_credentials',
    ]);
    expect(await artwork.countPending()).toBe(1);
  });

  it('links the IGDB cover and screenshot for a game without a Steam app', async () => {
    const ref = await provider.addWithDeferredArtwork('3', entry);
    expect(await games.get(ref.id)).toMatchObject({
      steamAppId: null,
      cover: `${IGDB_IMAGES}/t_cover_big/co3.jpg`,
      banner: `${IGDB_IMAGES}/t_screenshot_huge/sc3.jpg`,
    });
    expect(await flag(ref.id)).toBe(1);
  });

  it('leaves the normal add unchanged: artwork archived at once and nothing pending', async () => {
    const ref = await provider.add('1');
    expect(await flag(ref.id)).toBe(0);
    expect(await images.findBySourceUrl(`${STEAM}/11/library_hero.jpg`)).toBeDefined();
  });
});

describe('GameArtworkBackfill', () => {
  it('archives the cover and banner, links SteamGridDB and clears the flag', async () => {
    const ref = await provider.addWithDeferredArtwork('1', entry);
    expect(await backfill.runBatch()).toBe(1);
    expect(await images.findBySourceUrl(`${STEAM}/11/library_600x900_2x.jpg`)).toBeDefined();
    expect(await images.findBySourceUrl(`${STEAM}/11/library_hero.jpg`)).toBeDefined();
    expect(await games.get(ref.id)).toMatchObject({
      steamGridDbId: 911,
      cover: `${STEAM}/11/library_600x900_2x.jpg`,
      banner: `${STEAM}/11/library_hero.jpg`,
    });
    expect(await flag(ref.id)).toBe(0);
    expect(await backfill.remaining()).toBe(0);
    expect(await backfill.runBatch()).toBe(0);
  });

  it('archives the IGDB art of a game without a Steam app and skips SteamGridDB', async () => {
    const ref = await provider.addWithDeferredArtwork('3', entry);
    await backfill.runBatch();
    expect(await images.findBySourceUrl(`${IGDB_IMAGES}/t_cover_big/co3.jpg`)).toBeDefined();
    expect((await games.get(ref.id))?.steamGridDbId).toBeNull();
    expect(calls.some((url) => url.includes('steamgriddb'))).toBe(false);
    expect(await flag(ref.id)).toBe(0);
  });

  it('replaces a Steam image that cannot be fetched with the IGDB art, asking IGDB only then', async () => {
    missing.add(`${STEAM}/22/library_600x900_2x.jpg`);
    const ref = await provider.addWithDeferredArtwork('2', entry);
    const igdbCalls = calls.filter((url) => url === 'https://api.igdb.com/v4/games').length;
    await backfill.runBatch();
    expect(calls.filter((url) => url === 'https://api.igdb.com/v4/games')).toHaveLength(
      igdbCalls + 1,
    );
    expect(await games.get(ref.id)).toMatchObject({
      cover: `${IGDB_IMAGES}/t_cover_big/co2.jpg`,
      banner: `${STEAM}/22/library_hero.jpg`,
      steamGridDbId: 922,
    });
    expect(await images.findBySourceUrl(`${IGDB_IMAGES}/t_cover_big/co2.jpg`)).toBeDefined();
    expect(await flag(ref.id)).toBe(0);
  });

  it('does not ask IGDB again when both Steam images are fine', async () => {
    await provider.addWithDeferredArtwork('1', entry);
    const before = calls.filter((url) => url === 'https://api.igdb.com/v4/games').length;
    await backfill.runBatch();
    expect(calls.filter((url) => url === 'https://api.igdb.com/v4/games')).toHaveLength(before);
  });

  it('leaves an image empty when Steam and IGDB both fail, and still clears the flag', async () => {
    missing.add(`${STEAM}/44/library_600x900_2x.jpg`);
    missing.add(`${STEAM}/44/library_hero.jpg`);
    const ref = await provider.addWithDeferredArtwork('4', entry);
    igdbDown = true;
    expect(await backfill.runBatch()).toBe(1);
    expect(await games.get(ref.id)).toMatchObject({ cover: null, banner: null });
    expect(await flag(ref.id)).toBe(0);
    expect(errors[0]).toContain(`IGDB lookup of game ${ref.id} failed`);
    expect(await backfill.runBatch()).toBe(0);
  });

  it('keeps an IGDB image linked when it cannot be archived', async () => {
    missing.add(`${IGDB_IMAGES}/t_720p/co3.jpg`);
    const ref = await provider.addWithDeferredArtwork('3', entry);
    await backfill.runBatch();
    expect((await games.get(ref.id))?.cover).toBe(`${IGDB_IMAGES}/t_cover_big/co3.jpg`);
    expect(await flag(ref.id)).toBe(0);
  });

  it('prepares only as many games as the budget allows, lowest id first', async () => {
    const ids = [
      (await provider.addWithDeferredArtwork('1', entry)).id,
      (await provider.addWithDeferredArtwork('2', entry)).id,
      (await provider.addWithDeferredArtwork('3', entry)).id,
    ];
    expect(await backfill.runBatch({ budget: 21 })).toBe(1);
    expect(await flag(ids[0] as number)).toBe(0);
    expect(await flag(ids[1] as number)).toBe(1);
    expect(await backfill.runBatch({ budget: 100 })).toBe(2);
    expect(await backfill.remaining()).toBe(0);
  });

  it('prepares only the games in the library of the given user', async () => {
    const mine = await provider.addWithDeferredArtwork('1', entry);
    db.exec("INSERT INTO user (id, name, role, created_at) VALUES (2, 'Other', 'normal', 'now')");
    db.exec("INSERT INTO videogame (id, title, artwork_pending) VALUES (50, 'Theirs', 1)");
    db.exec('INSERT INTO videogame_entry (user_id, videogame_id) VALUES (2, 50)');
    expect(await backfill.remaining(1)).toBe(1);
    expect(await backfill.remaining(2)).toBe(1);
    expect(await backfill.remaining()).toBe(2);
    expect(await backfill.runBatch({ userId: 1 })).toBe(1);
    expect(await flag(mine.id)).toBe(0);
    expect(await flag(50)).toBe(1);
  });

  it('leaves a game pending when the database write fails', async () => {
    const ref = await provider.addWithDeferredArtwork('1', entry);
    const failing = new GameArtworkBackfill(
      {
        listPending: (limit: number, userId?: number) => artwork.listPending(limit, userId),
        complete: () => Promise.reject(new Error('D1 down')),
      } as never,
      images,
      new IgdbClient(fetch, { clientId: 'c', clientSecret: 's' }),
      null,
      logger,
    );
    await expect(failing.runBatch()).rejects.toThrow('D1 down');
    expect(await flag(ref.id)).toBe(1);
  });
});

describe('the artwork scheduler and the scheduled tick', () => {
  it('the scheduler runs one batch and survives a failing one', async () => {
    await provider.addWithDeferredArtwork('1', entry);
    const scheduler = new GameArtworkScheduler(backfill, logger);
    expect(await scheduler.tick()).toBe(1);
    expect(await scheduler.tick()).toBe(0);
    const broken = new GameArtworkScheduler(
      { runBatch: () => Promise.reject(new Error('boom')) } as unknown as GameArtworkBackfill,
      logger,
    );
    expect(await broken.tick()).toBe(0);
    expect(errors.at(-1)).toContain('boom');
  });

  it('the Worker tick prepares artwork and logs how many games', async () => {
    await provider.addWithDeferredArtwork('1', entry);
    const lines: string[] = [];
    const tickLogger = { info: (m: string) => lines.push(m), error: (m: string) => lines.push(m) };
    const accounts = { eraseDue: async () => [] } as never;
    await new ScheduledTick({ accounts, artwork: backfill, logger: tickLogger }).run(0);
    expect(lines.at(-1)).toContain('artwork=1');
    expect(await backfill.remaining()).toBe(0);
  });

  it('the Worker tick leaves the artwork alone when it erased an account or filled runtimes', async () => {
    await provider.addWithDeferredArtwork('1', entry);
    const lines: string[] = [];
    const tickLogger = { info: (m: string) => lines.push(m), error: (m: string) => lines.push(m) };
    await new ScheduledTick({
      accounts: { eraseDue: async () => [5] } as never,
      artwork: backfill,
      logger: tickLogger,
    }).run(0);
    await new ScheduledTick({
      accounts: { eraseDue: async () => [] } as never,
      runtimes: { runBatch: async () => 3 } as never,
      artwork: backfill,
      logger: tickLogger,
    }).run(0);
    expect(lines.some((line) => line.includes('artwork='))).toBe(false);
    expect(await backfill.remaining()).toBe(1);
  });

  it('the Worker tick logs a failing backfill without rejecting', async () => {
    const lines: string[] = [];
    const tickLogger = { info: (m: string) => lines.push(m), error: (m: string) => lines.push(m) };
    const tick = new ScheduledTick({
      accounts: { eraseDue: async () => [] } as never,
      artwork: { runBatch: () => Promise.reject(new Error('boom')) } as never,
      logger: tickLogger,
    });
    await expect(tick.run(0)).resolves.toBeUndefined();
    expect(lines.some((line) => line.includes('game artwork backfill failed: boom'))).toBe(true);
  });
});
