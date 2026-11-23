import { beforeEach, describe, expect, it } from 'vitest';
import type {
  EpisodeOperation,
  MediaStatus,
  NextEpisodesResponse,
  SeasonEpisodesUpdateResponse,
  Viewing,
} from '@metrack/domain';
import type { FetchFn } from '../src/http/FetchFn.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';

let api: TestApi;

const fetchFn = (async () => new Response('missing', { status: 404 })) as FetchFn;

beforeEach(async () => {
  api = await createTestApi(fetchFn);
});

const day = (date: string): Viewing => ({ startedAt: date, finishedAt: date });

interface SeasonSpec {
  number: number;
  status: MediaStatus;
  count: number;
  startedAt?: string;
  finishedAt?: string;
}

function addShow(title: string, seasons: SeasonSpec[], watches: Record<string, Viewing[]> = {}) {
  const seriesId = Number(
    api.db
      .prepare('INSERT INTO series (tmdb_id, title) VALUES (?, ?)')
      .run(Math.floor(Math.random() * 1e9), title).lastInsertRowid,
  );
  api.db.prepare('INSERT INTO series_entry (user_id, series_id) VALUES (1, ?)').run(seriesId);
  const seasonIds = seasons.map((season) => {
    const id = Number(
      api.db
        .prepare(
          'INSERT INTO season (series_id, number, tmdb_season_number, episode_count) VALUES (?, ?, ?, ?)',
        )
        .run(seriesId, season.number, season.number, season.count).lastInsertRowid,
    );
    api.db
      .prepare(
        'INSERT INTO season_entry (user_id, season_id, status, started_at, finished_at, watched_count) VALUES (1, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        season.status,
        season.startedAt ?? null,
        season.finishedAt ?? null,
        Object.keys(watches).filter((key) => key.startsWith(`${season.number}0`)).length,
      );
    api.db
      .prepare(
        "INSERT INTO season_episodes (season_id, episodes, source, fetched_at, complete) VALUES (?, ?, 'tmdb', ?, 1)",
      )
      .run(
        id,
        JSON.stringify(
          Array.from({ length: season.count }, (_, index) => ({
            number: index + 1,
            title: `Episode ${index + 1}`,
            airDate: '2026-01-01',
            runtime: 24,
            tmdbId: season.number * 100 + index + 1,
            overview: null,
            stillPath: null,
          })),
        ),
        '2026-03-01T00:00:00.000Z',
      );
    return id;
  });
  api.db
    .prepare(
      'INSERT INTO series_episode_entry (user_id, series_id, watched, skipped) VALUES (1, ?, ?, ?)',
    )
    .run(seriesId, JSON.stringify(watches), '[]');
  return { seriesId, seasonIds };
}

const keys = (season: number, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => String(season * 100 + from + i));

async function mark(seasonId: number, list: string[], date: string) {
  const operation: EpisodeOperation = { op: 'mark', keys: list, date };
  const response = await api.app.inject({
    method: 'PATCH',
    url: `/api/seasons/${seasonId}/episodes`,
    payload: operation,
  });
  expect(response.statusCode).toBe(200);
  return response.json<SeasonEpisodesUpdateResponse>();
}

async function restart(seasonId: number, method: 'POST' | 'DELETE' = 'POST') {
  return api.app.inject({ method, url: `/api/seasons/${seasonId}/restart` });
}

async function next(): Promise<NextEpisodesResponse> {
  return (await api.app.inject({ method: 'GET', url: '/api/next' })).json();
}

const seasonRow = (id: number) =>
  api.db.prepare('SELECT * FROM season_entry WHERE season_id = ?').get(id) as Record<
    string,
    unknown
  >;

describe('starting a season over', () => {
  const firstPass = Object.fromEntries(
    keys(1, 1, 3).map((key, index) => [key, [day(`2026-02-0${index + 1}`)]]),
  );

  it('keeps the old pass and completes the new one with the real date of the last episode', async () => {
    const { seasonIds } = addShow(
      'Show',
      [{ number: 1, status: 'in_progress', count: 10, startedAt: '2026-02-01' }],
      firstPass,
    );
    const seasonId = seasonIds[0] ?? 0;
    const started = await restart(seasonId);
    expect(started.statusCode).toBe(200);
    expect(started.json<SeasonEpisodesUpdateResponse>()).toMatchObject({
      watchedCount: 0,
      tracking: {
        status: 'in_progress',
        startedAt: null,
        finishedAt: null,
        abandoned: [
          { startedAt: '2026-02-01', finishedAt: '2026-02-03', restartedOn: '2026-03-05' },
        ],
      },
    });
    const row = (await next()).rows[0];
    expect(row).toMatchObject({ episode: { number: 1 }, progress: { watched: 0, total: 10 } });
    expect(row?.labels).toEqual([]);

    await mark(seasonId, keys(1, 1, 3), '2026-03-05');
    const done = await mark(seasonId, keys(1, 4, 10), '2026-03-06');
    expect(done.tracking).toMatchObject({
      status: 'completed',
      startedAt: '2026-03-05',
      finishedAt: '2026-03-06',
      rewatches: [],
    });
    expect(done.watchedCount).toBe(10);
    expect(done.episodes.filter((episode) => episode.viewings.length === 2)).toHaveLength(3);
    expect(done.episodes.filter((episode) => episode.viewings.length === 1)).toHaveLength(7);
    expect(done.episodes.filter((episode) => episode.skipped)).toHaveLength(0);
    expect(done.tracking.abandoned).toHaveLength(1);
  });

  it('refuses the same day, a season not in progress and nothing watched', async () => {
    const { seasonIds } = addShow('Today', [{ number: 1, status: 'in_progress', count: 4 }], {
      '101': [day('2026-03-05')],
    });
    const sameDay = await restart(seasonIds[0] ?? 0);
    expect(sameDay.statusCode).toBe(400);
    expect(sameDay.json<{ code: string }>().code).toBe('restart_same_day');
    const none = addShow('None', [{ number: 1, status: 'in_progress', count: 4 }]);
    expect((await restart(none.seasonIds[0] ?? 0)).statusCode).toBe(400);
    const done = addShow('Done', [{ number: 1, status: 'completed', count: 4 }], {
      '101': [day('2026-01-05')],
    });
    expect((await restart(done.seasonIds[0] ?? 0)).statusCode).toBe(400);
  });

  it('undoes the restart and derives the season from its watches again', async () => {
    const { seasonIds } = addShow(
      'Undo',
      [{ number: 1, status: 'in_progress', count: 10, startedAt: '2026-02-01' }],
      firstPass,
    );
    const seasonId = seasonIds[0] ?? 0;
    await restart(seasonId);
    const undone = await restart(seasonId, 'DELETE');
    expect(undone.statusCode).toBe(200);
    expect(undone.json<SeasonEpisodesUpdateResponse>()).toMatchObject({
      watchedCount: 3,
      tracking: { status: 'in_progress', startedAt: '2026-02-01', abandoned: [] },
    });
    expect(seasonRow(seasonId).abandoned).toBe('[]');
    expect((await restart(seasonId, 'DELETE')).statusCode).toBe(400);
  });
});

describe('starting a finished series over', () => {
  it('rewatches season 1, continues with season 2 and opens its rewatch by marking its first episode', async () => {
    const watches = Object.fromEntries(
      [1, 2, 3].flatMap((season) =>
        keys(season, 1, 2).map((key) => [key, [day(`2026-01-0${season}`)]]),
      ),
    );
    const { seasonIds } = addShow(
      'Trilogy',
      [1, 2, 3].map((number) => ({
        number,
        status: 'completed' as const,
        count: 2,
        startedAt: `2026-01-0${number}`,
        finishedAt: `2026-01-0${number}`,
      })),
      watches,
    );
    const [one = 0, two = 0, three = 0] = seasonIds;
    expect((await next()).rows).toHaveLength(0);

    const opened = await api.app.inject({
      method: 'PATCH',
      url: `/api/seasons/${one}`,
      payload: { rewatches: [{ startedAt: '2026-02-01', finishedAt: null }] },
    });
    expect(opened.statusCode).toBe(200);
    let row = (await next()).rows[0];
    expect(row).toMatchObject({
      season: { number: 1 },
      episode: { number: 1 },
      labels: ['rewatch'],
    });

    await mark(one, keys(1, 1, 2), '2026-02-02');
    row = (await next()).rows[0];
    expect(row).toMatchObject({
      season: { number: 2 },
      episode: { number: 1 },
      labels: ['rewatch'],
    });

    await mark(two, keys(2, 1, 1), '2026-02-03');
    expect(JSON.parse(String(seasonRow(two).rewatches))).toEqual([
      { startedAt: '2026-02-03', finishedAt: null },
    ]);
    row = (await next()).rows[0];
    expect(row).toMatchObject({
      season: { number: 2 },
      episode: { number: 2 },
      labels: ['rewatch'],
    });

    await mark(two, keys(2, 2, 2), '2026-02-03');
    row = (await next()).rows[0];
    expect(row).toMatchObject({
      season: { number: 3 },
      episode: { number: 1 },
      labels: ['rewatch'],
    });

    await mark(three, keys(3, 1, 2), '2026-02-04');
    expect((await next()).rows).toHaveLength(0);
  });
});
