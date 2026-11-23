import { beforeEach, describe, expect, it } from 'vitest';
import type { EpisodeOperation, SeasonEpisodesUpdateResponse } from '@metrack/domain';
import type { FetchFn } from '../src/http/FetchFn.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';

let api: TestApi;

const fetchFn = (async () => new Response('missing', { status: 404 })) as FetchFn;

beforeEach(async () => {
  api = await createTestApi(fetchFn);
});

function addSeason(ids: number[]): number {
  const series = Number(
    api.db.prepare('INSERT INTO series (tmdb_id, title) VALUES (4242, ?)').run('Show')
      .lastInsertRowid,
  );
  const season = Number(
    api.db
      .prepare(
        'INSERT INTO season (series_id, number, tmdb_season_number, episode_count) VALUES (?, 1, 1, ?)',
      )
      .run(series, ids.length).lastInsertRowid,
  );
  api.db.prepare('INSERT INTO series_entry (user_id, series_id) VALUES (1, ?)').run(series);
  api.db.prepare('INSERT INTO season_entry (user_id, season_id) VALUES (1, ?)').run(season);
  api.db
    .prepare(
      "INSERT INTO season_episodes (season_id, episodes, source, fetched_at, complete) VALUES (?, ?, 'tmdb', ?, 1)",
    )
    .run(
      season,
      JSON.stringify(
        ids.map((tmdbId, index) => ({
          number: index + 1,
          title: null,
          airDate: '2020-01-01',
          runtime: null,
          tmdbId,
          overview: null,
          stillPath: null,
        })),
      ),
      new Date().toISOString(),
    );
  return season;
}

async function patch(seasonId: number, body: EpisodeOperation) {
  const response = await api.app.inject({
    method: 'PATCH',
    url: `/api/seasons/${seasonId}/episodes`,
    payload: body,
  });
  return { status: response.statusCode, body: response.json() as SeasonEpisodesUpdateResponse };
}

const entry = (seasonId: number) =>
  api.db
    .prepare(
      'SELECT status, started_at, finished_at, watched_count, skipped_count, rewatches FROM season_entry WHERE season_id = ?',
    )
    .get(seasonId) as Record<string, unknown>;

const stored = () =>
  api.db.prepare('SELECT watched, skipped FROM series_episode_entry').get() as {
    watched: string;
    skipped: string;
  };

describe('skipping episodes', () => {
  it('completes a season once every episode is watched or skipped, with the finish date of the watched ones', async () => {
    const season = addSeason([101, 102, 103]);
    await patch(season, { op: 'mark', keys: ['101'], date: '2026-02-01' });
    const skipped = await patch(season, { op: 'skip', keys: ['102'] });
    expect(skipped.body.skippedCount).toBe(1);
    expect(skipped.body.episodes.map((e) => e.skipped)).toEqual([false, true, false]);
    expect(skipped.body.tracking.status).toBe('in_progress');
    const done = await patch(season, { op: 'mark', keys: ['103'], date: '2026-02-05' });
    expect(done.body.tracking).toMatchObject({ status: 'completed', finishedAt: '2026-02-05' });
    expect(done.body.watchedCount).toBe(2);
    expect(entry(season)).toMatchObject({
      status: 'completed',
      watched_count: 2,
      skipped_count: 1,
    });
    expect(JSON.parse(stored().skipped)).toEqual(['102']);
  });

  it('completes when the last missing episode is skipped', async () => {
    const season = addSeason([101, 102]);
    await patch(season, { op: 'mark', keys: ['101'], date: '2026-02-01' });
    const { body } = await patch(season, { op: 'skip', keys: ['102'] });
    expect(body.tracking).toMatchObject({ status: 'completed', finishedAt: '2026-02-01' });
  });

  it('watching a skipped episode unskips it, by mark or setViewings', async () => {
    const season = addSeason([101, 102, 103]);
    await patch(season, { op: 'skip', keys: ['101', '102'] });
    const marked = await patch(season, { op: 'mark', keys: ['101'], date: '2026-02-01' });
    expect(marked.body.episodes.map((e) => [e.watched, e.skipped])).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ]);
    await patch(season, {
      op: 'setViewings',
      key: '102',
      viewings: [{ startedAt: null, finishedAt: '2026-02-02' }],
    });
    expect(JSON.parse(stored().skipped)).toEqual([]);
    expect(entry(season)).toMatchObject({ skipped_count: 0, watched_count: 2 });
  });

  it('skipping removes an undated watch, including the explicit undated viewing', async () => {
    const season = addSeason([101, 102]);
    await patch(season, { op: 'mark', keys: ['101'], date: null });
    await patch(season, {
      op: 'setViewings',
      key: '102',
      viewings: [],
    });
    api.db
      .prepare('UPDATE series_episode_entry SET watched = ?')
      .run(JSON.stringify({ '101': [], '102': [{ startedAt: null, finishedAt: null }] }));
    const { status, body } = await patch(season, { op: 'skip', keys: ['101', '102'] });
    expect(status).toBe(200);
    expect(body.episodes.map((e) => [e.watched, e.skipped])).toEqual([
      [false, true],
      [false, true],
    ]);
    expect(JSON.parse(stored().watched)).toEqual({});
    expect(entry(season)).toMatchObject({ watched_count: 0, skipped_count: 2 });
  });

  it('refuses to skip an episode with a dated viewing and changes nothing', async () => {
    const season = addSeason([101, 102]);
    await patch(season, { op: 'mark', keys: ['101'], date: '2026-02-01' });
    const { status, body } = await patch(season, { op: 'skip', keys: ['102', '101'] });
    expect(status).toBe(400);
    expect((body as unknown as { code: string }).code).toBe('episode_has_viewings');
    expect(JSON.parse(stored().skipped)).toEqual([]);
  });

  it('unskip reopens a completed season until the episode is watched', async () => {
    const season = addSeason([101, 102]);
    await patch(season, { op: 'mark', keys: ['101'], date: '2026-02-01' });
    await patch(season, { op: 'skip', keys: ['102'] });
    const { body } = await patch(season, { op: 'unskip', keys: ['102'] });
    expect(body.skippedCount).toBe(0);
    expect(body.episodes[1]).toMatchObject({ watched: false, skipped: false });
    expect(body.tracking.status).toBe('in_progress');
  });

  it('rejects a key outside the season', async () => {
    const season = addSeason([101]);
    expect((await patch(season, { op: 'skip', keys: ['999'] })).status).toBe(400);
  });
});
