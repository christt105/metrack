import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ImageStore } from '../src/images/ImageStore.js';
import type { FetchFn } from '../src/http/FetchFn.js';
import { IgdbClient } from '../src/providers/igdb/IgdbClient.js';
import type { IgdbGame } from '../src/providers/igdb/IgdbGame.js';
import { SteamGridDbClient } from '../src/providers/steamgriddb/SteamGridDbClient.js';
import { VideogameRepository } from '../src/storage/repositories/index.js';
import { IgdbGameProvider } from '../src/titles/IgdbGameProvider.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { png } from './support/sampleImages.js';

interface Call {
  url: string;
  method: string;
  body: string | null;
  headers: Headers;
}

const STEAM = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

const hades: IgdbGame = {
  id: 113112,
  name: 'Hades',
  first_release_date: 1600300800,
  summary: 'Defy  the god\nof the dead.',
  cover: { url: '//images.igdb.com/igdb/image/upload/t_thumb/co1.jpg' },
  screenshots: [{ url: '//images.igdb.com/igdb/image/upload/t_thumb/sc1.jpg' }],
  genres: [{ name: 'Role-playing (RPG)' }, { name: 'Indie' }],
  platforms: [{ name: 'PC (Microsoft Windows)' }],
  involved_companies: [
    { developer: false, company: { name: 'Publisher' } },
    { developer: true, company: { name: 'Supergiant Games' } },
  ],
  external_games: [{ external_game_source: 1, uid: '1145360' }],
};

function igdbFetch(options: {
  games: IgdbGame[];
  files?: Record<string, Buffer>;
  expireFirstToken?: boolean;
}) {
  const calls: Call[] = [];
  let tokens = 0;
  const fetchFn = ((input: string | URL, init?: RequestInit) => {
    const url = input.toString();
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: (init?.body as string) ?? null,
      headers,
    });
    if (url.startsWith('https://id.twitch.tv/oauth2/token')) {
      tokens += 1;
      return Promise.resolve(Response.json({ access_token: `t${tokens}`, expires_in: 3600 }));
    }
    if (url === 'https://api.igdb.com/v4/games') {
      if (options.expireFirstToken && headers.get('Authorization') === 'Bearer t1') {
        return Promise.resolve(new Response('expired', { status: 401 }));
      }
      const body = String(init?.body);
      const id = /where id = (\d+);/.exec(body)?.[1];
      return Promise.resolve(
        Response.json(id ? options.games.filter((g) => g.id === Number(id)) : options.games),
      );
    }
    if (url === 'https://www.steamgriddb.com/api/v2/games/steam/1145360') {
      return Promise.resolve(Response.json({ success: true, data: { id: 5248255 } }));
    }
    const file = options.files?.[url];
    return Promise.resolve(
      file ? new Response(new Uint8Array(file)) : new Response('missing', { status: 404 }),
    );
  }) as FetchFn;
  return { fetchFn, calls };
}

function setup(fetchFn: FetchFn, withSteamGridDb = true) {
  const db = openTestDatabase();
  const games = new VideogameRepository(db);
  const images = new ImageStore(db, mkdtempSync(join(tmpdir(), 'metrack-igdb-')), fetchFn);
  const client = new IgdbClient(fetchFn, { clientId: 'cid', clientSecret: 'secret' });
  const steamGridDb = withSteamGridDb ? new SteamGridDbClient(fetchFn, 'sgdb') : null;
  return { games, provider: new IgdbGameProvider(client, games, images, steamGridDb) };
}

describe('IgdbClient', () => {
  it('authenticates through Twitch, reuses the token and filters by year', async () => {
    const { fetchFn, calls } = igdbFetch({ games: [hades] });
    const client = new IgdbClient(fetchFn, { clientId: 'cid', clientSecret: 'secret' });
    await client.search('Ha"des', 2020);
    await client.search('Hades', null);
    const auth = calls.filter((c) => c.url.startsWith('https://id.twitch.tv'));
    expect(auth).toHaveLength(1);
    expect(new URL(auth[0]?.url ?? '').searchParams.get('grant_type')).toBe('client_credentials');
    const [first, second] = calls.filter((c) => c.url.startsWith('https://api.igdb.com'));
    expect(first?.method).toBe('POST');
    expect(first?.headers.get('Client-ID')).toBe('cid');
    expect(first?.headers.get('Authorization')).toBe('Bearer t1');
    expect(first?.body).toContain('search "Ha\\"des";');
    expect(first?.body).toContain(
      'first_release_date >= 1577836800 & first_release_date < 1609459200',
    );
    expect(second?.body).not.toContain('where');
  });

  it('gets a new token and retries once when IGDB answers 401', async () => {
    const { fetchFn, calls } = igdbFetch({ games: [hades], expireFirstToken: true });
    const client = new IgdbClient(fetchFn, { clientId: 'cid', clientSecret: 'secret' });
    expect(await client.game(113112)).toMatchObject({ name: 'Hades' });
    expect(calls.filter((c) => c.url.startsWith('https://id.twitch.tv'))).toHaveLength(2);
  });
});

describe('IgdbGameProvider', () => {
  it('maps search results and flags games already in the tracker', async () => {
    const { fetchFn } = igdbFetch({ games: [hades] });
    const t = setup(fetchFn);
    const before = await t.provider.search('Hades', null);
    expect(before[0]).toEqual({
      type: 'videogame',
      provider: 'igdb',
      externalId: '113112',
      title: 'Hades',
      originalTitle: null,
      year: 2020,
      overview: 'Defy the god of the dead.',
      posterUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_small/co1.jpg',
      existingId: null,
    });
    const ref = await t.provider.add('113112');
    expect((await t.provider.search('Hades', null))[0]?.existingId).toBe(ref.id);
  });

  it('adds a game with its metadata, Steam artwork and SteamGridDB id', async () => {
    const { fetchFn } = igdbFetch({
      games: [hades],
      files: {
        [`${STEAM}/1145360/library_600x900_2x.jpg`]: png(600, 900, 1),
        [`${STEAM}/1145360/library_hero.jpg`]: png(1920, 620, 2),
      },
    });
    const t = setup(fetchFn);
    const ref = await t.provider.add('113112');
    expect(ref.type).toBe('videogame');
    const game = t.games.get(ref.id);
    expect(game).toMatchObject({
      igdbId: 113112,
      steamAppId: '1145360',
      steamGridDbId: 5248255,
      title: 'Hades',
      releaseDate: '2020-09-17',
      overview: 'Defy the god of the dead.',
      genres: ['Role-playing (RPG)', 'Indie'],
      developer: 'Supergiant Games',
      platforms: ['PC (Microsoft Windows)'],
      status: 'planned',
    });
    expect(game?.cover).toMatch(/^\/api\/images\/[0-9a-f]{64}$/);
    expect(game?.banner).toMatch(/^\/api\/images\/[0-9a-f]{64}$/);
  });

  it('falls back to the IGDB cover and screenshot when Steam has no artwork', async () => {
    const { fetchFn } = igdbFetch({
      games: [hades],
      files: {
        'https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg': png(264, 374, 3),
        'https://images.igdb.com/igdb/image/upload/t_screenshot_huge/sc1.jpg': png(1280, 720, 4),
      },
    });
    const t = setup(fetchFn, false);
    const game = t.games.get((await t.provider.add('113112')).id);
    expect(game?.cover).not.toBeNull();
    expect(game?.banner).not.toBeNull();
    expect(game?.steamGridDbId).toBeNull();
  });

  it('refuses a game already added, an unknown id and a malformed id', async () => {
    const { fetchFn } = igdbFetch({ games: [hades] });
    const t = setup(fetchFn);
    const ref = await t.provider.add('113112');
    await expect(t.provider.add('113112')).rejects.toMatchObject({
      status: 409,
      details: { existingId: ref.id },
    });
    await expect(t.provider.add('999')).rejects.toMatchObject({ status: 404 });
    await expect(t.provider.add('abc')).rejects.toMatchObject({ status: 400 });
  });
});
