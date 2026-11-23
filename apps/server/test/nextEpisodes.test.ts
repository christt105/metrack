import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeOperation, MediaStatus, NextEpisodesResponse, Viewing } from '@metrack/domain';
import type { FetchFn } from '../src/http/FetchFn.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';

let api: TestApi;
const fetched: string[] = [];

const fetchFn = (async (url: string | URL | Request) => {
  fetched.push(String(url));
  return new Response('missing', { status: 404 });
}) as FetchFn;

beforeEach(async () => {
  fetched.length = 0;
  api = await createTestApi(fetchFn);
});

interface SeasonSpec {
  number: number;
  status: MediaStatus;
  episodes?: { id: number; airDate: string | null }[];
  watchedCount?: number;
  skippedCount?: number;
  episodeCount?: number | null;
  rewatches?: Viewing[];
}

interface ShowSpec {
  title: string;
  seasons: SeasonSpec[];
  watches?: Record<string, Viewing[]>;
  skipped?: string[];
  lastActivityAt?: string | null;
  userId?: number;
}

const day = (date: string): Viewing => ({ startedAt: date, finishedAt: date });

function addShow(spec: ShowSpec): { seriesId: number; seasonIds: number[] } {
  const userId = spec.userId ?? 1;
  const seriesId = Number(
    api.db
      .prepare('INSERT INTO series (tmdb_id, title) VALUES (?, ?)')
      .run(Math.floor(Math.random() * 1e9), spec.title).lastInsertRowid,
  );
  api.db
    .prepare('INSERT INTO series_entry (user_id, series_id) VALUES (?, ?)')
    .run(userId, seriesId);
  const seasonIds = spec.seasons.map((season) => {
    const id = Number(
      api.db
        .prepare(
          'INSERT INTO season (series_id, number, tmdb_season_number, episode_count) VALUES (?, ?, ?, ?)',
        )
        .run(
          seriesId,
          season.number,
          season.number,
          season.episodeCount ?? season.episodes?.length ?? 4,
        ).lastInsertRowid,
    );
    api.db
      .prepare(
        'INSERT INTO season_entry (user_id, season_id, status, watched_count, skipped_count, rewatches) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        userId,
        id,
        season.status,
        season.watchedCount ?? 0,
        season.skippedCount ?? 0,
        JSON.stringify(season.rewatches ?? []),
      );
    if (season.episodes) {
      api.db
        .prepare(
          "INSERT INTO season_episodes (season_id, episodes, source, fetched_at, complete) VALUES (?, ?, 'tmdb', ?, 1)",
        )
        .run(
          id,
          JSON.stringify(
            season.episodes.map((e, index) => ({
              number: index + 1,
              title: `Episode ${index + 1}`,
              airDate: e.airDate,
              runtime: 24,
              tmdbId: e.id,
              overview: null,
              stillPath: `/s${e.id}.jpg`,
            })),
          ),
          '2026-03-01T00:00:00.000Z',
        );
    }
    return id;
  });
  if (spec.watches || spec.skipped || spec.lastActivityAt !== undefined) {
    api.db
      .prepare(
        'INSERT INTO series_episode_entry (user_id, series_id, watched, skipped, last_activity_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        userId,
        seriesId,
        JSON.stringify(spec.watches ?? {}),
        JSON.stringify(spec.skipped ?? []),
        spec.lastActivityAt ?? null,
      );
  }
  return { seriesId, seasonIds };
}

const aired = (...ids: number[]) => ids.map((id) => ({ id, airDate: '2026-01-01' }));

async function next(query = '', headers: Record<string, string> = {}) {
  const response = await api.app.inject({ method: 'GET', url: `/api/next${query}`, headers });
  return { status: response.statusCode, body: response.json<NextEpisodesResponse>() };
}

const titles = (body: NextEpisodesResponse) => body.rows.map((row) => row.series.title);

describe('GET /api/next', () => {
  it('answers with the next episode of a series in progress, from the stored catalog', async () => {
    const { seriesId, seasonIds } = addShow({
      title: 'Alpha',
      seasons: [{ number: 1, status: 'in_progress', episodes: aired(11, 12, 13), watchedCount: 1 }],
      watches: { '11': [day('2026-02-01')] },
      lastActivityAt: '2026-03-01T10:00:00.000Z',
    });
    const { status, body } = await next();
    expect(status).toBe(200);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      series: { id: seriesId, title: 'Alpha' },
      season: { id: seasonIds[0], number: 1 },
      episode: { number: 2, key: '12', title: 'Episode 2', stillPath: '/s12.jpg', runtime: 24 },
      source: 'tmdb',
      availability: 'ready',
      labels: [],
      progress: { watched: 1, total: 3, skipped: 0, rewatch: false },
      lastActivityAt: '2026-03-01T10:00:00.000Z',
    });
    expect(fetched).toEqual([]);
  });

  it('carries the filler classification once it is stored', async () => {
    const { seasonIds } = addShow({
      title: 'Alpha',
      seasons: [{ number: 1, status: 'in_progress', episodes: aired(11, 12) }],
    });
    api.db
      .prepare('INSERT INTO season_filler (season_id, slug, categories) VALUES (?, ?, ?)')
      .run(seasonIds[0] ?? 0, 'alpha', JSON.stringify({ '11': 'filler' }));
    expect((await next()).body.rows[0]?.episode.filler).toBe('filler');
  });

  it('shows an unaired next episode as airing and a season without catalog by number', async () => {
    addShow({
      title: 'Airing',
      seasons: [
        {
          number: 1,
          status: 'in_progress',
          episodes: [
            { id: 21, airDate: '2026-01-01' },
            { id: 22, airDate: '2026-03-20' },
          ],
          watchedCount: 1,
        },
      ],
      watches: { '21': [day('2026-02-01')] },
    });
    addShow({
      title: 'Bare',
      seasons: [{ number: 4, status: 'in_progress', watchedCount: 6, episodeCount: 12 }],
    });
    const { body } = await next();
    const byTitle = Object.fromEntries(body.rows.map((row) => [row.series.title, row]));
    expect(byTitle['Airing']).toMatchObject({
      availability: 'airs',
      airsOn: '2026-03-20',
      episode: { number: 2 },
    });
    expect(byTitle['Bare']).toMatchObject({
      source: 'numbers',
      episode: { number: 7, key: null },
      progress: { watched: 6, total: 12 },
    });
  });

  it('offers the next season of a completed one, and leaves out paused, dropped and finished series', async () => {
    addShow({
      title: 'New season',
      seasons: [
        { number: 1, status: 'completed', episodes: aired(31, 32), watchedCount: 2 },
        { number: 2, status: 'planned', episodes: aired(41, 42) },
      ],
    });
    addShow({ title: 'Paused', seasons: [{ number: 1, status: 'paused', episodes: aired(51) }] });
    addShow({ title: 'Dropped', seasons: [{ number: 1, status: 'dropped', episodes: aired(61) }] });
    addShow({ title: 'Done', seasons: [{ number: 1, status: 'completed', episodes: aired(71) }] });
    addShow({
      title: 'Caught up',
      seasons: [{ number: 1, status: 'in_progress', episodes: aired(81), watchedCount: 1 }],
      watches: { '81': [day('2026-02-01')] },
    });
    const { body } = await next();
    expect(titles(body)).toEqual(['New season']);
    expect(body.rows[0]).toMatchObject({
      season: { number: 2 },
      labels: ['newSeason'],
      episode: { number: 1 },
    });
  });

  it('puts a rewatch in progress first among the seasons, labelled', async () => {
    addShow({
      title: 'Again',
      seasons: [
        {
          number: 1,
          status: 'completed',
          episodes: aired(91, 92),
          watchedCount: 2,
          rewatches: [{ startedAt: '2026-03-01', finishedAt: null }],
        },
      ],
      watches: { '91': [day('2026-01-05'), day('2026-03-02')], '92': [day('2026-01-06')] },
    });
    const { body } = await next();
    expect(body.rows[0]).toMatchObject({
      labels: ['rewatch'],
      episode: { number: 2 },
      progress: { watched: 1, total: 2, rewatch: true },
    });
  });

  it('sorts by last activity, then the series without it by their latest viewing', async () => {
    let id = 1000;
    const show = (title: string, lastActivityAt: string | null, viewed: string | null) => {
      id += 2;
      addShow({
        title,
        seasons: [{ number: 1, status: 'in_progress', episodes: aired(id, id + 1) }],
        watches: viewed ? { [String(id)]: [day(viewed)] } : {},
        lastActivityAt,
      });
    };
    show('Old activity', '2026-03-01T08:00:00.000Z', '2026-03-01');
    show('New activity', '2026-03-04T09:00:00.000Z', '2026-02-01');
    show('Viewed March', null, '2026-03-02');
    show('Viewed January', null, '2026-01-02');
    show('Never', null, null);
    expect(titles((await next()).body)).toEqual([
      'New activity',
      'Old activity',
      'Viewed March',
      'Viewed January',
      'Never',
    ]);
  });

  it('narrows to one series, or to nothing when nothing is next for it', async () => {
    const wanted = addShow({
      title: 'Wanted',
      seasons: [{ number: 1, status: 'in_progress', episodes: aired(101) }],
    });
    addShow({
      title: 'Other',
      seasons: [{ number: 1, status: 'in_progress', episodes: aired(102) }],
    });
    const done = addShow({ title: 'Done', seasons: [{ number: 1, status: 'completed' }] });
    expect(titles((await next(`?series=${wanted.seriesId}`)).body)).toEqual(['Wanted']);
    expect((await next(`?series=${done.seriesId}`)).body.rows).toEqual([]);
    expect((await next('?series=99999')).body.rows).toEqual([]);
    expect((await next('?series=abc')).status).toBe(400);
  });

  it('only sees the series of the user it acts for', async () => {
    await new SqliteUserRepository(api.db).create({ name: 'Friend', email: null });
    const theirs = addShow({
      title: 'Theirs',
      userId: 2,
      seasons: [{ number: 1, status: 'in_progress', episodes: aired(111) }],
    });
    addShow({
      title: 'Mine',
      seasons: [{ number: 1, status: 'in_progress', episodes: aired(112) }],
    });
    expect(titles((await next()).body)).toEqual(['Mine']);
    expect((await next(`?series=${theirs.seriesId}`)).body.rows).toEqual([]);
  });

  it('can be read with a read-only token', async () => {
    addShow({
      title: 'Mine',
      seasons: [{ number: 1, status: 'in_progress', episodes: aired(121) }],
    });
    const { secret } = await api.tokens.create(1, {
      name: 'reader',
      scope: 'read',
      expiresInDays: null,
    });
    const { status, body } = await next('', { authorization: `Bearer ${secret}` });
    expect(status).toBe(200);
    expect(titles(body)).toEqual(['Mine']);
  });

  it('reads only the candidate series: the cost does not grow with the series that are not next', async () => {
    const count = async () => {
      const spy = vi.spyOn(api.db, 'prepare');
      await next();
      const calls = spy.mock.calls.length;
      spy.mockRestore();
      return calls;
    };
    for (let i = 0; i < 3; i += 1) {
      addShow({
        title: `Active ${i}`,
        seasons: [{ number: 1, status: 'in_progress', episodes: aired(200 + i * 2, 201 + i * 2) }],
      });
    }
    const before = await count();
    for (let i = 0; i < 20; i += 1) {
      addShow({
        title: `Idle ${i}`,
        seasons: [
          { number: 1, status: i % 2 === 0 ? 'completed' : 'paused', episodes: aired(300 + i) },
        ],
        watches: { [String(300 + i)]: [day('2026-01-01')] },
      });
    }
    expect(await count()).toBe(before);
    expect(before).toBeLessThanOrEqual(2 + 3 * 3);
    expect(fetched).toEqual([]);
  });
});

describe('last_activity_at', () => {
  async function patch(seasonId: number, body: EpisodeOperation) {
    return api.app.inject({
      method: 'PATCH',
      url: `/api/seasons/${seasonId}/episodes`,
      payload: body,
    });
  }
  const activity = (seriesId: number) =>
    (
      api.db
        .prepare('SELECT last_activity_at FROM series_episode_entry WHERE series_id = ?')
        .get(seriesId) as { last_activity_at: string | null } | undefined
    )?.last_activity_at;

  it('is written when an episode is marked or skipped, and moves the series to the top', async () => {
    const first = addShow({
      title: 'First',
      seasons: [{ number: 1, status: 'in_progress', episodes: aired(401, 402, 403) }],
    });
    const second = addShow({
      title: 'Second',
      seasons: [{ number: 1, status: 'in_progress', episodes: aired(411, 412, 413) }],
      lastActivityAt: '2026-03-04T00:00:00.000Z',
    });
    expect(titles((await next()).body)).toEqual(['Second', 'First']);
    expect(
      (await patch(first.seasonIds[0] ?? 0, { op: 'mark', keys: ['401'], date: '2026-03-05' }))
        .statusCode,
    ).toBe(200);
    expect(activity(first.seriesId)).toBe('2026-03-05T12:00:00.000Z');
    expect(titles((await next()).body)).toEqual(['First', 'Second']);
    expect((await patch(second.seasonIds[0] ?? 0, { op: 'skip', keys: ['412'] })).statusCode).toBe(
      200,
    );
    expect(activity(second.seriesId)).toBe('2026-03-05T12:00:00.000Z');
  });
});
