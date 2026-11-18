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
    still_path: `/still${id}.jpg`,
    crew: [{ name: 'Ignored' }],
    guest_stars: [{ name: 'Ignored' }],
  };
}

function seasonHandler(episodes: object[]): Handler {
  return () => Response.json({ episodes });
}

function tooLarge(): Handler {
  return () => new Response('{}', { headers: { 'content-length': String(MEGABYTE + 1) } });
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
    watchedCount?: number;
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
      .prepare(
        'INSERT INTO season_entry (user_id, season_id, status, watched_count) VALUES (?, ?, ?, ?)',
      )
      .run(user, season, options.status ?? 'in_progress', options.watchedCount ?? 0);
  }
  return { id: season, seriesId: series };
}

function storeCatalog(
  seasonId: number,
  fetchedAt: string,
  episodes: object[],
  complete = true,
): void {
  api.db
    .prepare(
      "INSERT INTO season_episodes (season_id, episodes, source, fetched_at, complete) VALUES (?, ?, 'tmdb', ?, ?)",
    )
    .run(seasonId, JSON.stringify(episodes), fetchedAt, complete ? 1 : 0);
}

function storeWatches(userId: number, seriesId: number, watched: object): void {
  api.db
    .prepare('INSERT INTO series_episode_entry (user_id, series_id, watched) VALUES (?, ?, ?)')
    .run(userId, seriesId, JSON.stringify(watched));
}

const watchedRows = () =>
  api.db
    .prepare('SELECT user_id, watched FROM series_episode_entry ORDER BY user_id')
    .all()
    .map((row) => [row.user_id, JSON.parse(String(row.watched))]);

const compact = (number: number, tmdbId: number | null, title: string | null = `E${number}`) => ({
  number,
  title,
  airDate: '2024-01-0' + number,
  runtime: 24,
  tmdbId,
  overview: null,
  stillPath: tmdbId === null ? null : `/still${tmdbId}.jpg`,
});

const countOf = (seasonId: number) =>
  api.db.prepare('SELECT episode_count FROM season WHERE id = ?').get(seasonId);

async function episodes(client: ReturnType<typeof as>, seasonId: number) {
  const response = await client.get(`/api/seasons/${seasonId}/episodes`);
  return { status: response.statusCode, body: response.json() as SeasonEpisodesResponse };
}

const viewing = { startedAt: null, finishedAt: '2026-03-01' };

function groupHandler(): Handler {
  return () =>
    Response.json({
      id: 'grp',
      name: 'Seasons',
      type: 6,
      groups: [
        {
          id: 'a',
          name: 'S1',
          order: 1,
          episodes: [{ id: 30, season_number: 1, episode_number: 5, name: 'Earlier', order: 0 }],
        },
        {
          id: 'b',
          name: 'S2',
          order: 2,
          episodes: [
            { id: 32, season_number: 1, episode_number: 7, order: 2, still_path: '/s32.jpg' },
            { id: 31, season_number: 1, episode_number: 6, name: 'Later', order: 1 },
            { id: 30, season_number: 1, episode_number: 5, name: 'Earlier', order: 0 },
          ],
        },
      ],
    });
}

describe('GET /api/seasons/:id/episodes', () => {
  it('answers from the stored catalog without asking TMDB', async () => {
    const season = addSeason();
    storeCatalog(season.id, NOW.toISOString(), [compact(1, 11), compact(2, 12)]);
    storeWatches(1, season.seriesId, { '12': [viewing] });
    const { status, body } = await episodes(owner, season.id);
    expect(status).toBe(200);
    expect(calls).toEqual([]);
    expect(body).toMatchObject({
      seasonId: season.id,
      source: 'tmdb',
      fetchedAt: NOW.toISOString(),
      complete: true,
      episodeCount: 2,
      watchedCount: 1,
    });
    expect(body.episodes).toEqual([
      {
        key: '11',
        number: 1,
        tmdbId: 11,
        title: 'E1',
        airDate: '2024-01-01',
        runtime: 24,
        overview: null,
        stillPath: '/still11.jpg',
        watched: false,
        viewings: [],
      },
      {
        key: '12',
        number: 2,
        tmdbId: 12,
        title: 'E2',
        airDate: '2024-01-02',
        runtime: 24,
        overview: null,
        stillPath: '/still12.jpg',
        watched: true,
        viewings: [viewing],
      },
    ]);
  });

  it('fetches a missing catalog once, stores it with the still paths and sets the episode count', async () => {
    const season = addSeason({ episodeCount: null });
    handlers.set(
      `/3/tv/${SERIES_TMDB_ID}/season/1`,
      seasonHandler([tmdbEpisode(11, 1, 'Pilot'), tmdbEpisode(12, 2, 'Second')]),
    );
    const first = await episodes(owner, season.id);
    expect(first.body.source).toBe('tmdb');
    expect(first.body.episodes.map((e) => [e.key, e.number, e.title, e.stillPath])).toEqual([
      ['11', 1, 'Pilot', '/still11.jpg'],
      ['12', 2, 'Second', '/still12.jpg'],
    ]);
    const stored = api.db.prepare('SELECT * FROM season_episodes').all();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.complete).toBe(1);
    expect(JSON.parse(String(stored[0]?.episodes))[0]).toEqual({
      number: 1,
      title: 'Pilot',
      airDate: '2024-01-01',
      runtime: 24,
      tmdbId: 11,
      overview: 'About Pilot',
      stillPath: '/still11.jpg',
    });
    expect(countOf(season.id)).toEqual({ episode_count: 2 });
    await episodes(owner, season.id);
    expect(calls).toHaveLength(1);
  });

  it('lets the catalog own the episode count and bumps the content version only when it changes', async () => {
    const season = addSeason({ episodeCount: 24 });
    handlers.set(
      `/3/tv/${SERIES_TMDB_ID}/season/1`,
      seasonHandler([tmdbEpisode(11, 1, 'A'), tmdbEpisode(12, 2, 'B')]),
    );
    const before = await versions.global();
    await episodes(owner, season.id);
    expect(countOf(season.id)).toEqual({ episode_count: 2 });
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
    expect(body).toMatchObject({
      source: 'numbers',
      fetchedAt: null,
      complete: true,
      episodeCount: 3,
    });
    expect(body.episodes.map((e) => [e.key, e.number, e.title, e.watched])).toEqual([
      ['s1e1', 1, null, false],
      ['s1e2', 2, null, false],
      ['s1e3', 3, null, false],
    ]);
    expect(api.db.prepare('SELECT * FROM season_episodes').all()).toEqual([]);
    await episodes(owner, season.id);
    expect(calls).toHaveLength(2);
  });

  it('lists bare numbers without asking TMDB when the series has no TMDB id', async () => {
    const season = addSeason({ tmdbId: null, episodeCount: 2 });
    storeWatches(1, season.seriesId, { s1e2: [viewing] });
    const { body } = await episodes(owner, season.id);
    expect(body.source).toBe('numbers');
    expect(body.episodes.map((e) => [e.key, e.watched])).toEqual([
      ['s1e1', false],
      ['s1e2', true],
    ]);
    expect(body.watchedCount).toBe(1);
    expect(calls).toEqual([]);
  });

  it('answers 404 for a season the user has no entry for', async () => {
    const season = addSeason({ users: [1] });
    expect((await episodes(normal, season.id)).status).toBe(404);
    expect((await episodes(owner, 99999)).status).toBe(404);
    expect(calls).toEqual([]);
  });

  it('counts every episode of a completed season without watches as watched, without dates', async () => {
    const season = addSeason({ status: 'completed', episodeCount: 2, watchedCount: 2 });
    storeCatalog(season.id, NOW.toISOString(), [compact(1, 11), compact(2, 12)]);
    const { body } = await episodes(owner, season.id);
    expect(body.watchedCount).toBe(2);
    expect(body.episodes.map((e) => [e.watched, e.viewings])).toEqual([
      [true, []],
      [true, []],
    ]);
  });

  it('uses the stored watches of a completed season that has some, and none when its count is 0', async () => {
    const season = addSeason({ status: 'completed', watchedCount: 1 });
    storeCatalog(season.id, NOW.toISOString(), [compact(1, 11), compact(2, 12)]);
    storeWatches(1, season.seriesId, { '11': [] });
    const { body } = await episodes(owner, season.id);
    expect(body.watchedCount).toBe(1);
    expect(body.episodes.map((e) => e.watched)).toEqual([true, false]);

    const emptied = addSeason({ tmdbId: 888, status: 'completed', watchedCount: 0 });
    storeCatalog(emptied.id, NOW.toISOString(), [compact(1, 11), compact(2, 12)]);
    expect((await episodes(owner, emptied.id)).body.watchedCount).toBe(0);
  });

  it('reads the watches of the user who asks only', async () => {
    const season = addSeason({ users: [1, 2] });
    storeCatalog(season.id, NOW.toISOString(), [compact(1, 11)]);
    storeWatches(1, season.seriesId, { '11': [] });
    expect((await episodes(owner, season.id)).body.watchedCount).toBe(1);
    expect((await episodes(normal, season.id)).body.watchedCount).toBe(0);
  });

  it('moves the numbering keys of the season to TMDB ids once the catalog has them', async () => {
    const season = addSeason({ users: [1, 2], episodeCount: 3 });
    storeWatches(1, season.seriesId, { s1e1: [viewing], s2e1: [], s1e9: [] });
    storeWatches(2, season.seriesId, { s1e2: [] });
    handlers.set(
      `/3/tv/${SERIES_TMDB_ID}/season/1`,
      seasonHandler([tmdbEpisode(11, 1, 'A'), tmdbEpisode(12, 2, 'B'), tmdbEpisode(13, 3, 'C')]),
    );
    const { body } = await episodes(owner, season.id);
    expect(body.episodes.map((e) => [e.key, e.watched])).toEqual([
      ['11', true],
      ['12', false],
      ['13', false],
    ]);
    expect(watchedRows()).toEqual([
      [1, { '11': [viewing], s2e1: [], s1e9: [] }],
      [2, { s1e2: [] }],
    ]);
    await episodes(normal, season.id);
    expect(watchedRows()[1]).toEqual([2, { '12': [] }]);
  });

  it('keeps the numbering keys while there is no catalog', async () => {
    const season = addSeason({ episodeCount: 2 });
    storeWatches(1, season.seriesId, { s1e1: [] });
    await episodes(owner, season.id);
    expect(watchedRows()).toEqual([[1, { s1e1: [] }]]);
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
    expect(statements.filter((sql) => /season_episodes|series_episode/.test(sql))).toEqual([]);
  });

  describe('for a series that follows an episode group', () => {
    it('takes the season of the group with one request, numbering by place in the group', async () => {
      const season = addSeason({
        episodeGroup: 'grp',
        tmdbSeasonNumber: 2,
        number: 2,
        episodeCount: 59,
      });
      handlers.set('/3/tv/episode_group/grp', groupHandler());
      const before = await versions.global();
      const { body } = await episodes(owner, season.id);
      expect(body.complete).toBe(true);
      expect(body.episodes.map((e) => [e.key, e.number, e.title, e.stillPath])).toEqual([
        ['30', 1, 'Earlier', null],
        ['31', 2, 'Later', null],
        ['32', 3, null, '/s32.jpg'],
      ]);
      expect(calls).toEqual(['/3/tv/episode_group/grp']);
      expect(countOf(season.id)).toEqual({ episode_count: 3 });
      expect((await versions.global()).total).toBe(before.total + 1);
    });

    it('answers numbers when the group has no season of that order', async () => {
      const season = addSeason({ episodeGroup: 'grp', tmdbSeasonNumber: 5, episodeCount: 2 });
      handlers.set('/3/tv/episode_group/grp', groupHandler());
      const { body } = await episodes(owner, season.id);
      expect(body.source).toBe('numbers');
      expect(body.episodes).toHaveLength(2);
      expect(api.db.prepare('SELECT * FROM season_episodes').all()).toEqual([]);
    });

    it('does not move watches when the series changes group: they follow the episode ids', async () => {
      const regular = addSeason({ tmdbSeasonNumber: 1, episodeCount: 2 });
      storeWatches(1, regular.seriesId, { '30': [viewing] });
      handlers.set(
        `/3/tv/${SERIES_TMDB_ID}/season/1`,
        seasonHandler([tmdbEpisode(29, 1, 'Zero'), tmdbEpisode(30, 2, 'Earlier')]),
      );
      const first = await episodes(owner, regular.id);
      expect(first.body.episodes.map((e) => [e.number, e.watched])).toEqual([
        [1, false],
        [2, true],
      ]);

      api.db
        .prepare('UPDATE series SET tmdb_episode_group = ? WHERE id = ?')
        .run('grp', regular.seriesId);
      api.db
        .prepare('UPDATE season SET tmdb_season_number = 2, number = 2 WHERE id = ?')
        .run(regular.id);
      api.db.prepare('DELETE FROM season_episodes').run();
      handlers.set('/3/tv/episode_group/grp', groupHandler());
      const second = await episodes(owner, regular.id);
      expect(second.body.episodes.map((e) => [e.key, e.number, e.watched])).toEqual([
        ['30', 1, true],
        ['31', 2, false],
        ['32', 3, false],
      ]);
      expect(watchedRows()).toEqual([[1, { '30': [viewing] }]]);
    });
  });

  describe('for a regular season over 1 MB', () => {
    const episodePath = (n: number) => `/3/tv/${SERIES_TMDB_ID}/season/1/episode/${n}`;

    function setUpChunks(total: number): void {
      handlers.set(`/3/tv/${SERIES_TMDB_ID}/season/1`, tooLarge());
      for (let n = 1; n <= total; n++) {
        handlers.set(episodePath(n), () => Response.json(tmdbEpisode(100 + n, n, `E${n}`)));
      }
    }

    it('fills the catalog 15 episodes per request until it is complete', async () => {
      const season = addSeason({ episodeCount: 20 });
      setUpChunks(20);
      const first = await episodes(owner, season.id);
      expect(first.body.complete).toBe(false);
      expect(first.body.episodes.map((e) => e.number)).toEqual(
        Array.from({ length: 15 }, (_, i) => i + 1),
      );
      expect(calls.filter((c) => c.includes('/episode/'))).toHaveLength(15);
      expect(api.db.prepare('SELECT complete FROM season_episodes').get()).toEqual({ complete: 0 });
      expect(countOf(season.id)).toEqual({ episode_count: 20 });

      calls = [];
      const second = await episodes(owner, season.id);
      expect(second.body.complete).toBe(true);
      expect(second.body.episodes.map((e) => e.number)).toEqual(
        Array.from({ length: 20 }, (_, i) => i + 1),
      );
      expect(calls.sort()).toEqual([20, 16, 17, 18, 19].map(episodePath).sort());
      expect(api.db.prepare('SELECT complete FROM season_episodes').get()).toEqual({ complete: 1 });

      calls = [];
      await episodes(owner, season.id);
      expect(calls).toEqual([]);
    });

    it('does not bump the content version while the catalog is partial', async () => {
      const season = addSeason({ episodeCount: 20 });
      setUpChunks(20);
      const before = await versions.global();
      await episodes(owner, season.id);
      expect(await versions.global()).toEqual(before);
    });

    it('keeps what it has and tries again when a chunk fails', async () => {
      const season = addSeason({ episodeCount: 20 });
      setUpChunks(20);
      await episodes(owner, season.id);
      for (let n = 16; n <= 20; n++) handlers.delete(episodePath(n));
      const failed = await episodes(owner, season.id);
      expect(failed.body.complete).toBe(false);
      expect(failed.body.episodes).toHaveLength(15);
    });

    it('lists bare numbers when the season has no episode count to chunk by', async () => {
      const season = addSeason({ episodeCount: null });
      setUpChunks(5);
      const { body } = await episodes(owner, season.id);
      expect(body.source).toBe('numbers');
      expect(body.episodes).toEqual([]);
    });

    it('restarts from the first episode when a complete catalog goes stale', async () => {
      const season = addSeason({ episodeCount: 20 });
      setUpChunks(20);
      storeCatalog(
        season.id,
        '2025-01-01T00:00:00.000Z',
        Array.from({ length: 20 }, (_, i) => compact(i + 1, 100 + i + 1)),
      );
      const { body } = await episodes(owner, season.id);
      expect(body.complete).toBe(false);
      expect(body.episodes).toHaveLength(15);
    });

    it('stops reading a streamed season document that grows past 1 MB', async () => {
      const season = addSeason({ episodeCount: 2 });
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
      handlers.set(episodePath(1), () => Response.json(tmdbEpisode(101, 1, 'E1')));
      handlers.set(episodePath(2), () => Response.json(tmdbEpisode(102, 2, 'E2')));
      const { body } = await episodes(owner, season.id);
      expect(cancelled).toBe(true);
      expect(sent).toBeLessThan(2 * MEGABYTE);
      expect(body).toMatchObject({ source: 'tmdb', complete: true });
      expect(body.episodes).toHaveLength(2);
    });
  });
});
