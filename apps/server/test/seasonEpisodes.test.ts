import { beforeEach, describe, expect, it } from 'vitest';
import type { SeasonEpisodesResponse } from '@metrack/domain';
import type { Authenticator } from '../src/auth/Authenticator.js';
import type { FetchFn } from '../src/http/FetchFn.js';
import { MemoryContentVersions } from '../src/site/MemoryContentVersions.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { createTestApi, NOW, type TestApi } from './support/createTestApi.js';

const SERIES_TMDB_ID = 4242;
const MEGABYTE = 1_000_000;

type Handler = () => Response | Promise<Response>;

let api: TestApi;
let users: SqliteUserRepository;
let versions: MemoryContentVersions;
let handlers: Map<string, Handler>;
let calls: string[];

const byHeader: Authenticator = {
  userFor: async (headers) => users.get(Number(headers.get('x-test-user'))),
};

const fetchFn = (async (input: string | URL | Request) => {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  calls.push(url.pathname);
  const handler = handlers.get(url.pathname);
  return handler ? handler() : new Response('missing', { status: 404 });
}) as FetchFn;

function tmdbEpisode(id: number, number: number, name: string, airDate = '2024-01-01') {
  return {
    id,
    episode_number: number,
    name,
    air_date: airDate,
    runtime: 24,
    overview: `About ${name}`,
    crew: [{ name: 'Ignored' }],
    guest_stars: [{ name: 'Ignored' }],
  };
}

function seasonHandler(episodes: object[]): Handler {
  return () => Response.json({ episodes });
}

beforeEach(async () => {
  handlers = new Map();
  calls = [];
  versions = new MemoryContentVersions();
  api = await createTestApi(fetchFn, {
    scope: new AsyncUserScope(),
    authenticator: byHeader,
    contentVersions: versions,
  });
  users = new SqliteUserRepository(api.db);
  await users.create({ name: 'Normal', email: null });
  await users.create({ name: 'Other', email: null });
});

function as(userId: number) {
  const headers = { 'x-test-user': String(userId) };
  return {
    get: (url: string) => api.app.inject({ method: 'GET', url, headers }),
  };
}

const owner = as(1);
const normal = as(2);

interface SeasonSetup {
  id: number;
  seriesId: number;
}

function addSeason(
  options: {
    tmdbId?: number | null;
    episodeGroup?: string | null;
    episodeCount?: number | null;
    status?: string;
    users?: number[];
    tmdbSeasonNumber?: number | null;
    number?: number;
  } = {},
): SeasonSetup {
  const tmdbId = options.tmdbId === undefined ? SERIES_TMDB_ID : options.tmdbId;
  const series = Number(
    api.db
      .prepare('INSERT INTO series (tmdb_id, tmdb_episode_group, title) VALUES (?, ?, ?)')
      .run(tmdbId, options.episodeGroup ?? null, 'Show').lastInsertRowid,
  );
  const season = Number(
    api.db
      .prepare(
        'INSERT INTO season (series_id, number, tmdb_season_number, episode_count) VALUES (?, ?, ?, ?)',
      )
      .run(
        series,
        options.number ?? 1,
        options.tmdbSeasonNumber === undefined ? 1 : options.tmdbSeasonNumber,
        options.episodeCount === undefined ? 2 : options.episodeCount,
      ).lastInsertRowid,
  );
  for (const user of options.users ?? [1]) {
    api.db.prepare('INSERT INTO series_entry (user_id, series_id) VALUES (?, ?)').run(user, series);
    api.db
      .prepare('INSERT INTO season_entry (user_id, season_id, status) VALUES (?, ?, ?)')
      .run(user, season, options.status ?? 'in_progress');
  }
  return { id: season, seriesId: series };
}

function storeCatalog(seasonId: number, fetchedAt: string, episodes: object[]): void {
  api.db
    .prepare(
      "INSERT INTO season_episodes (season_id, episodes, source, fetched_at) VALUES (?, ?, 'tmdb', ?)",
    )
    .run(seasonId, JSON.stringify(episodes), fetchedAt);
}

function storeWatches(userId: number, seasonId: number, watched: object): void {
  api.db
    .prepare('INSERT INTO season_episode_entry (user_id, season_id, watched) VALUES (?, ?, ?)')
    .run(userId, seasonId, JSON.stringify(watched));
}

const compact = (number: number, tmdbId: number | null, title: string | null = `E${number}`) => ({
  number,
  title,
  airDate: '2024-01-0' + number,
  runtime: 24,
  tmdbId,
  overview: null,
});

async function episodes(client: ReturnType<typeof as>, seasonId: number) {
  const response = await client.get(`/api/seasons/${seasonId}/episodes`);
  return { status: response.statusCode, body: response.json() as SeasonEpisodesResponse };
}

describe('GET /api/seasons/:id/episodes', () => {
  it('answers from the stored catalog without asking TMDB', async () => {
    const season = addSeason();
    storeCatalog(season.id, NOW.toISOString(), [compact(1, 11), compact(2, 12)]);
    storeWatches(1, season.id, { '2': [{ startedAt: null, finishedAt: '2026-03-01' }] });
    const { status, body } = await episodes(owner, season.id);
    expect(status).toBe(200);
    expect(calls).toEqual([]);
    expect(body).toMatchObject({
      seasonId: season.id,
      source: 'tmdb',
      fetchedAt: NOW.toISOString(),
      episodeCount: 2,
      watchedCount: 1,
    });
    expect(body.episodes).toEqual([
      {
        number: 1,
        title: 'E1',
        airDate: '2024-01-01',
        runtime: 24,
        overview: null,
        watched: false,
        viewings: [],
      },
      {
        number: 2,
        title: 'E2',
        airDate: '2024-01-02',
        runtime: 24,
        overview: null,
        watched: true,
        viewings: [{ startedAt: null, finishedAt: '2026-03-01' }],
      },
    ]);
  });

  it('fetches a missing catalog once, stores it and fills a missing season episode count', async () => {
    const season = addSeason({ episodeCount: null });
    handlers.set(
      `/3/tv/${SERIES_TMDB_ID}/season/1`,
      seasonHandler([tmdbEpisode(11, 1, 'Pilot'), tmdbEpisode(12, 2, 'Second')]),
    );
    const first = await episodes(owner, season.id);
    expect(first.body.source).toBe('tmdb');
    expect(first.body.episodes.map((e) => [e.number, e.title, e.overview])).toEqual([
      [1, 'Pilot', 'About Pilot'],
      [2, 'Second', 'About Second'],
    ]);
    const stored = api.db.prepare('SELECT * FROM season_episodes').all();
    expect(stored).toHaveLength(1);
    expect(JSON.parse(String(stored[0]?.episodes))[0]).toEqual({
      number: 1,
      title: 'Pilot',
      airDate: '2024-01-01',
      runtime: 24,
      tmdbId: 11,
      overview: 'About Pilot',
    });
    expect(api.db.prepare('SELECT episode_count FROM season WHERE id = ?').get(season.id)).toEqual({
      episode_count: 2,
    });
    await episodes(owner, season.id);
    expect(calls).toHaveLength(1);
  });

  it('bumps the content version only when it fills a missing episode count', async () => {
    const season = addSeason({ episodeCount: null });
    handlers.set(
      `/3/tv/${SERIES_TMDB_ID}/season/1`,
      seasonHandler([tmdbEpisode(11, 1, 'A'), tmdbEpisode(12, 2, 'B')]),
    );
    const before = await versions.global();
    await episodes(owner, season.id);
    const changed = await versions.global();
    expect(changed.total).toBe(before.total + 1);
    await episodes(owner, season.id);
    expect(await versions.global()).toEqual(changed);

    const same = addSeason({ tmdbId: 555, episodeCount: 2 });
    handlers.set(
      '/3/tv/555/season/1',
      seasonHandler([tmdbEpisode(21, 1, 'A'), tmdbEpisode(22, 2, 'B')]),
    );
    await episodes(owner, same.id);
    expect(await versions.global()).toEqual(changed);
  });

  it('refreshes a catalog that went stale: after a day when airing, after 30 days otherwise', async () => {
    const airing = addSeason({ episodeCount: 1 });
    api.db
      .prepare(
        'UPDATE series SET next_episode_season = 1, next_episode_number = 3, next_episode_air_date = ? WHERE id = ?',
      )
      .run('2099-01-01', airing.seriesId);
    storeCatalog(airing.id, '2026-03-03T00:00:00.000Z', [compact(1, 11)]);
    const idle = addSeason({ tmdbId: 777, episodeCount: 1 });
    storeCatalog(idle.id, '2026-02-20T00:00:00.000Z', [compact(1, 11)]);
    handlers.set(`/3/tv/${SERIES_TMDB_ID}/season/1`, seasonHandler([tmdbEpisode(11, 1, 'New')]));
    handlers.set('/3/tv/777/season/1', seasonHandler([tmdbEpisode(11, 1, 'New')]));

    expect((await episodes(owner, airing.id)).body.episodes[0]?.title).toBe('New');
    expect((await episodes(owner, idle.id)).body.episodes[0]?.title).toBe('E1');
    expect(calls).toEqual([`/3/tv/${SERIES_TMDB_ID}/season/1`]);

    api.db
      .prepare('UPDATE season_episodes SET fetched_at = ? WHERE season_id = ?')
      .run('2026-01-01T00:00:00.000Z', idle.id);
    expect((await episodes(owner, idle.id)).body.episodes[0]?.title).toBe('New');
  });

  it('serves the stale catalog when the refresh fails', async () => {
    const season = addSeason();
    storeCatalog(season.id, '2025-01-01T00:00:00.000Z', [compact(1, 11), compact(2, 12)]);
    const { body } = await episodes(owner, season.id);
    expect(calls).toHaveLength(1);
    expect(body.source).toBe('tmdb');
    expect(body.episodes).toHaveLength(2);
    expect(api.db.prepare('SELECT fetched_at FROM season_episodes').get()).toEqual({
      fetched_at: '2025-01-01T00:00:00.000Z',
    });
  });

  it('lists bare numbers and stores nothing when TMDB fails', async () => {
    const season = addSeason({ episodeCount: 3 });
    const { status, body } = await episodes(owner, season.id);
    expect(status).toBe(200);
    expect(body).toMatchObject({ source: 'numbers', fetchedAt: null, episodeCount: 3 });
    expect(body.episodes.map((e) => [e.number, e.title, e.watched])).toEqual([
      [1, null, false],
      [2, null, false],
      [3, null, false],
    ]);
    expect(api.db.prepare('SELECT * FROM season_episodes').all()).toEqual([]);
    await episodes(owner, season.id);
    expect(calls).toHaveLength(2);
  });

  it('lists bare numbers without asking TMDB when the series has no TMDB id', async () => {
    const season = addSeason({ tmdbId: null, episodeCount: 2 });
    const { body } = await episodes(owner, season.id);
    expect(body.source).toBe('numbers');
    expect(body.episodes).toHaveLength(2);
    expect(calls).toEqual([]);
  });

  it('refuses a season document over 1 MB that declares its length', async () => {
    const season = addSeason();
    handlers.set(
      `/3/tv/${SERIES_TMDB_ID}/season/1`,
      () =>
        new Response(JSON.stringify({ episodes: [tmdbEpisode(11, 1, 'A')] }), {
          headers: { 'content-length': String(MEGABYTE + 1) },
        }),
    );
    const { body } = await episodes(owner, season.id);
    expect(body.source).toBe('numbers');
    expect(api.db.prepare('SELECT * FROM season_episodes').all()).toEqual([]);
  });

  it('stops reading a streamed season document that grows past 1 MB', async () => {
    const season = addSeason();
    let sent = 0;
    let cancelled = false;
    handlers.set(`/3/tv/${SERIES_TMDB_ID}/season/1`, () => {
      const chunk = new TextEncoder().encode(' '.repeat(100_000));
      return new Response(
        new ReadableStream({
          pull(controller) {
            sent += chunk.byteLength;
            controller.enqueue(chunk);
          },
          cancel() {
            cancelled = true;
          },
        }),
      );
    });
    const { body } = await episodes(owner, season.id);
    expect(body.source).toBe('numbers');
    expect(cancelled).toBe(true);
    expect(sent).toBeLessThan(2 * MEGABYTE);
  });

  it('answers 404 for a season the user has no entry for', async () => {
    const season = addSeason({ users: [1] });
    expect((await episodes(normal, season.id)).status).toBe(404);
    expect((await episodes(owner, 99999)).status).toBe(404);
    expect(calls).toEqual([]);
  });

  it('counts every episode of a completed season without a watch row as watched, without dates', async () => {
    const season = addSeason({ status: 'completed', episodeCount: 2 });
    storeCatalog(season.id, NOW.toISOString(), [compact(1, 11), compact(2, 12)]);
    const { body } = await episodes(owner, season.id);
    expect(body.watchedCount).toBe(2);
    expect(body.episodes.map((e) => [e.watched, e.viewings])).toEqual([
      [true, []],
      [true, []],
    ]);
  });

  it('uses the stored watches of a completed season when it has a row', async () => {
    const season = addSeason({ status: 'completed' });
    storeCatalog(season.id, NOW.toISOString(), [compact(1, 11), compact(2, 12)]);
    storeWatches(1, season.id, { '1': [] });
    const { body } = await episodes(owner, season.id);
    expect(body.watchedCount).toBe(1);
    expect(body.episodes.map((e) => e.watched)).toEqual([true, false]);
  });

  it('reads the watches of the user who asks only', async () => {
    const season = addSeason({ users: [1, 2] });
    storeCatalog(season.id, NOW.toISOString(), [compact(1, 11)]);
    storeWatches(1, season.id, { '1': [] });
    expect((await episodes(owner, season.id)).body.watchedCount).toBe(1);
    expect((await episodes(normal, season.id)).body.watchedCount).toBe(0);
  });

  it('moves every user watches by TMDB id when a refresh renumbers the episodes', async () => {
    const season = addSeason({ users: [1, 2], episodeCount: 3 });
    storeCatalog(season.id, '2025-01-01T00:00:00.000Z', [
      compact(1, 11),
      compact(2, 12),
      compact(3, 13),
    ]);
    storeWatches(1, season.id, { '1': [{ startedAt: null, finishedAt: '2026-01-01' }] });
    storeWatches(2, season.id, { '3': [], '9': [] });
    handlers.set(
      `/3/tv/${SERIES_TMDB_ID}/season/1`,
      seasonHandler([tmdbEpisode(13, 1, 'C'), tmdbEpisode(11, 2, 'A'), tmdbEpisode(12, 3, 'B')]),
    );
    const { body } = await episodes(owner, season.id);
    expect(body.episodes.map((e) => [e.number, e.watched])).toEqual([
      [1, false],
      [2, true],
      [3, false],
    ]);
    const rows = api.db
      .prepare('SELECT user_id, watched FROM season_episode_entry ORDER BY user_id')
      .all()
      .map((row) => [row.user_id, JSON.parse(String(row.watched))]);
    expect(rows).toEqual([
      [1, { '2': [{ startedAt: null, finishedAt: '2026-01-01' }] }],
      [2, { '1': [], '9': [] }],
    ]);
  });

  it('follows the episode group of the series, numbering by place in the group', async () => {
    const season = addSeason({ episodeGroup: 'grp', tmdbSeasonNumber: 2, number: 2 });
    handlers.set('/3/tv/episode_group/grp', () =>
      Response.json({
        id: 'grp',
        name: 'Seasons',
        type: 6,
        groups: [
          {
            id: 'a',
            name: 'S1',
            order: 1,
            episodes: [{ season_number: 1, episode_number: 1, order: 0 }],
          },
          {
            id: 'b',
            name: 'S2',
            order: 2,
            episodes: [
              { id: 31, season_number: 1, episode_number: 6, name: 'Later', order: 1 },
              { id: 30, season_number: 1, episode_number: 5, name: 'Earlier', order: 0 },
            ],
          },
        ],
      }),
    );
    const { body } = await episodes(owner, season.id);
    expect(body.episodes.map((e) => [e.number, e.title])).toEqual([
      [1, 'Earlier'],
      [2, 'Later'],
    ]);
    expect(calls).toEqual(['/3/tv/episode_group/grp']);
  });

  it('keeps the library list and public pages off the episode tables', async () => {
    const season = addSeason();
    storeCatalog(season.id, NOW.toISOString(), [compact(1, 11)]);
    const statements: string[] = [];
    const original = api.db.prepare.bind(api.db);
    api.db.prepare = ((sql: string) => {
      statements.push(sql);
      return original(sql);
    }) as typeof api.db.prepare;
    expect((await owner.get('/api/media')).statusCode).toBe(200);
    expect(statements.filter((sql) => /season_episode/.test(sql))).toEqual([]);
  });

  describe('against the season episode count the sync stored', () => {
    const merged = (count: number) =>
      Array.from({ length: count }, (_, i) =>
        tmdbEpisode(100 + i, i + 1, `E${i + 1}`, '2024-01-01'),
      );
    const countOf = (seasonId: number) =>
      api.db.prepare('SELECT episode_count FROM season WHERE id = ?').get(seasonId);

    it('keeps the stored count and answers numbers when TMDB merges seasons', async () => {
      const season = addSeason({ episodeCount: 24 });
      handlers.set(`/3/tv/${SERIES_TMDB_ID}/season/1`, seasonHandler(merged(60)));
      const before = await versions.global();
      const { body } = await episodes(owner, season.id);
      expect(body).toMatchObject({
        source: 'numbers',
        fetchedAt: null,
        episodeCount: 24,
        catalogMismatch: { catalogEpisodes: 60 },
      });
      expect(body.episodes).toHaveLength(24);
      expect(body.episodes.every((e) => e.title === null)).toBe(true);
      expect(countOf(season.id)).toEqual({ episode_count: 24 });
      expect(await versions.global()).toEqual(before);
      expect(api.db.prepare('SELECT * FROM season_episodes').all()).toHaveLength(1);
      await episodes(owner, season.id);
      expect(calls).toHaveLength(1);
    });

    it('does not remap watches when the refreshed catalog does not apply', async () => {
      const season = addSeason({ episodeCount: 2 });
      storeCatalog(season.id, '2025-01-01T00:00:00.000Z', [compact(1, 11), compact(2, 12)]);
      storeWatches(1, season.id, { '1': [] });
      handlers.set(
        `/3/tv/${SERIES_TMDB_ID}/season/1`,
        seasonHandler([tmdbEpisode(12, 1, 'B'), tmdbEpisode(11, 2, 'A'), tmdbEpisode(13, 3, 'C')]),
      );
      const { body } = await episodes(owner, season.id);
      expect(body.catalogMismatch).toEqual({ catalogEpisodes: 3 });
      expect(api.db.prepare('SELECT watched FROM season_episode_entry').get()).toEqual({
        watched: '{"1":[]}',
      });
    });

    it('fills a missing count from the catalog and bumps the content version', async () => {
      const season = addSeason({ episodeCount: null });
      handlers.set(`/3/tv/${SERIES_TMDB_ID}/season/1`, seasonHandler(merged(3)));
      const before = await versions.global();
      const { body } = await episodes(owner, season.id);
      expect(body).toMatchObject({ source: 'tmdb', episodeCount: 3, catalogMismatch: null });
      expect(countOf(season.id)).toEqual({ episode_count: 3 });
      expect((await versions.global()).total).toBe(before.total + 1);
    });

    it('lists episodes still to air without changing the count', async () => {
      const season = addSeason({ episodeCount: 2 });
      handlers.set(
        `/3/tv/${SERIES_TMDB_ID}/season/1`,
        seasonHandler([
          tmdbEpisode(1, 1, 'A', '2024-01-01'),
          tmdbEpisode(2, 2, 'B', '2024-01-08'),
          tmdbEpisode(3, 3, 'C', '2099-01-01'),
        ]),
      );
      const before = await versions.global();
      const { body } = await episodes(owner, season.id);
      expect(body).toMatchObject({ source: 'tmdb', episodeCount: 3, catalogMismatch: null });
      expect(body.episodes.map((e) => e.title)).toEqual(['A', 'B', 'C']);
      expect(countOf(season.id)).toEqual({ episode_count: 2 });
      expect(await versions.global()).toEqual(before);
    });

    it('answers numbers with a mismatch when the catalog is shorter', async () => {
      const season = addSeason({ episodeCount: 5 });
      storeCatalog(season.id, NOW.toISOString(), [compact(1, 11), compact(2, 12)]);
      const { body } = await episodes(owner, season.id);
      expect(body).toMatchObject({
        source: 'numbers',
        episodeCount: 5,
        catalogMismatch: { catalogEpisodes: 2 },
      });
    });
  });
});
