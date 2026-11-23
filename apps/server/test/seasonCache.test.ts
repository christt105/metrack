import { beforeEach, describe, expect, it } from 'vitest';
import type { Authenticator } from '../src/auth/Authenticator.js';
import type { FetchFn } from '../src/http/FetchFn.js';
import type { SeasonCacheReport } from '../src/seasons/SeasonCacheReport.js';
import { SeasonCacheChecker } from '../src/seasons/SeasonCacheChecker.js';
import { SeasonCacheJob } from '../src/seasons/SeasonCacheJob.js';
import { SeriesWatchTracker } from '../src/seasons/SeriesWatchTracker.js';
import { MemoryContentVersions } from '../src/site/MemoryContentVersions.js';
import { createSqliteRepositories } from '../src/storage/sqlite/createSqliteRepositories.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';

let api: TestApi;
let users: SqliteUserRepository;
let versions: MemoryContentVersions;
let scope: AsyncUserScope;

const byHeader: Authenticator = {
  userFor: async (headers) => users.get(Number(headers.get('x-test-user'))),
};

const fetchFn = (async () => new Response('missing', { status: 404 })) as FetchFn;

beforeEach(async () => {
  versions = new MemoryContentVersions();
  scope = new AsyncUserScope();
  api = await createTestApi(fetchFn, { scope, authenticator: byHeader, contentVersions: versions });
  users = new SqliteUserRepository(api.db);
  await users.create({ name: 'Normal', email: null });
});

function addFrieren(userId = 1) {
  const series = Number(
    api.db.prepare('INSERT INTO series (tmdb_id, title) VALUES (4242, ?)').run('Show')
      .lastInsertRowid,
  );
  const season = Number(
    api.db
      .prepare(
        'INSERT INTO season (series_id, number, tmdb_season_number, episode_count) VALUES (?, 1, 1, 2)',
      )
      .run(series).lastInsertRowid,
  );
  api.db.prepare('INSERT INTO series_entry (user_id, series_id) VALUES (?, ?)').run(userId, series);
  api.db
    .prepare(
      `INSERT INTO season_entry (user_id, season_id, status, started_at, finished_at, rewatches, watched_count)
       VALUES (?, ?, 'completed', '2026-11-23', '2026-11-18', '[{"startedAt":"2026-11-23","finishedAt":"2026-11-23"}]', 2)`,
    )
    .run(userId, season);
  api.db
    .prepare(
      `INSERT INTO season_episodes (season_id, episodes, source, fetched_at, complete)
       VALUES (?, ?, 'tmdb', '2026-11-20T00:00:00.000Z', 1)`,
    )
    .run(
      season,
      JSON.stringify([
        { number: 1, tmdbId: 101, title: 'One', airDate: '2026-01-01' },
        { number: 2, tmdbId: 102, title: 'Two', airDate: '2026-01-08' },
      ]),
    );
  api.db
    .prepare(
      'INSERT INTO series_episode_entry (user_id, series_id, watched, skipped) VALUES (?, ?, ?, ?)',
    )
    .run(
      userId,
      series,
      JSON.stringify({
        '101': [
          { startedAt: null, finishedAt: null },
          { startedAt: '2026-11-23', finishedAt: '2026-11-23' },
        ],
        '102': [],
      }),
      '[]',
    );
  return season;
}

function entryOf(userId: number, seasonId: number) {
  return api.db
    .prepare(
      'SELECT status, started_at, finished_at, rewatches, wants_rewatch FROM season_entry WHERE user_id = ? AND season_id = ?',
    )
    .get(userId, seasonId) as Record<string, unknown>;
}

async function call(method: 'GET' | 'POST', url: string, userId = 1) {
  const response = await api.app.inject({
    method,
    url,
    headers: { 'x-test-user': String(userId) },
  });
  return { status: response.statusCode, body: response.json() as SeasonCacheReport };
}

describe('the season cache check', () => {
  it('reports a season entry that differs from its episodes and changes nothing', async () => {
    const season = addFrieren();
    const { status, body } = await call('GET', '/api/season-cache');
    expect(status).toBe(200);
    expect(body.repaired).toBe(false);
    expect(body.drifts).toHaveLength(1);
    expect(body.drifts[0]).toMatchObject({ seasonId: season });
    expect(body.drifts[0]?.fields).toEqual(expect.arrayContaining(['startedAt', 'rewatches']));
    expect(entryOf(1, season)).toMatchObject({ started_at: '2026-11-23' });
  });

  it('repairs the entry from its episodes so that it is no longer reported', async () => {
    const season = addFrieren();
    const before = await versions.current(1);
    const repaired = await call('POST', '/api/season-cache/repair');
    expect(repaired.body.repaired).toBe(true);
    expect(repaired.body.drifts).toHaveLength(1);
    expect(entryOf(1, season)).toMatchObject({
      status: 'completed',
      started_at: '2026-11-18',
      finished_at: '2026-11-18',
      rewatches: '[]',
      wants_rewatch: 0,
    });
    expect((await call('GET', '/api/season-cache')).body.drifts).toEqual([]);
    expect(await versions.current(1)).toBe(before + 1);
  });

  it('only looks at the data of the signed-in user', async () => {
    addFrieren(1);
    expect((await call('GET', '/api/season-cache', 2)).body.drifts).toEqual([]);
  });

  it('is reported by the job, which never rewrites anything', async () => {
    const season = addFrieren();
    const lines: string[] = [];
    const repositories = createSqliteRepositories(api.db, scope);
    const checker = new SeasonCacheChecker(
      repositories.seasons,
      new SeriesWatchTracker({
        seasons: repositories.seasons,
        catalog: repositories.seasonEpisodes,
        watches: repositories.episodeWatches,
      }),
    );
    const job = new SeasonCacheJob(users, scope, checker, {
      info: () => undefined,
      error: (m) => lines.push(m),
    });
    expect(await job.run(new Date('2026-11-23T03:00:00Z'))).toBe(1);
    expect(lines[0]).toContain(`season ${season}`);
    expect(entryOf(1, season)).toMatchObject({ started_at: '2026-11-23' });
  });
});
