import { beforeEach, describe, expect, it } from 'vitest';
import type { SeasonEpisodesUpdateResponse } from '@metrack/domain';
import type { Authenticator } from '../src/auth/Authenticator.js';
import type { FetchFn } from '../src/http/FetchFn.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';

let api: TestApi;
let users: SqliteUserRepository;

const byHeader: Authenticator = {
  userFor: async (headers) => users.get(Number(headers.get('x-test-user'))),
};
const fetchFn = (async () => new Response('missing', { status: 404 })) as FetchFn;
const headers = { 'x-test-user': '1' };

beforeEach(async () => {
  api = await createTestApi(fetchFn, { scope: new AsyncUserScope(), authenticator: byHeader });
  users = new SqliteUserRepository(api.db);
});

function addSeason(episodeCount = 3): number {
  const series = Number(
    api.db.prepare('INSERT INTO series (tmdb_id, title) VALUES (4242, ?)').run('Show')
      .lastInsertRowid,
  );
  const season = Number(
    api.db
      .prepare(
        'INSERT INTO season (series_id, number, tmdb_season_number, episode_count) VALUES (?, 1, 1, ?)',
      )
      .run(series, episodeCount).lastInsertRowid,
  );
  api.db.prepare('INSERT INTO series_entry (user_id, series_id) VALUES (1, ?)').run(series);
  api.db
    .prepare('INSERT INTO season_entry (user_id, season_id, status) VALUES (1, ?, ?)')
    .run(season, 'planned');
  return season;
}

function watchesOf(seasonId: number): unknown {
  const row = api.db
    .prepare(
      'SELECT watched FROM series_episode_entry WHERE user_id = 1 AND series_id = (SELECT series_id FROM season WHERE id = ?)',
    )
    .get(seasonId) as { watched: string } | undefined;
  return row ? JSON.parse(row.watched) : undefined;
}

async function call(method: string, url: string, payload?: object) {
  const response = await api.app.inject({
    method: method as 'GET',
    url,
    headers,
    ...(payload ? { payload } : {}),
  });
  return { status: response.statusCode, body: response.json() as SeasonEpisodesUpdateResponse };
}

const patch = (season: number, payload: object) =>
  call('PATCH', `/api/seasons/${season}/episodes`, payload);

async function drifts(): Promise<number> {
  const response = await api.app.inject({ method: 'GET', url: '/api/season-cache', headers });
  return (response.json() as { drifts: unknown[] }).drifts.length;
}

const view = (finishedAt: string, startedAt: string | null = finishedAt) => ({
  startedAt,
  finishedAt,
});

async function twoPasses(): Promise<number> {
  const season = addSeason();
  const all = ['s1e1', 's1e2', 's1e3'];
  await patch(season, { op: 'mark', keys: all, date: '2026-01-10' });
  await call('PUT', `/api/seasons/${season}/rewatch-intent`, { wanted: true });
  await patch(season, { op: 'mark', keys: ['s1e1', 's1e2'], date: '2026-02-10' });
  return season;
}

describe('editing one viewing', () => {
  it('changes the dates of a viewing and leaves no drift', async () => {
    const season = await twoPasses();
    const { status, body } = await patch(season, {
      op: 'setViewings',
      key: 's1e1',
      viewings: [view('2026-01-09', '2026-01-08'), view('2026-02-10')],
    });
    expect(status).toBe(200);
    expect(body.episodes[0]?.viewings[0]).toEqual(view('2026-01-09', '2026-01-08'));
    expect(await drifts()).toBe(0);
  });

  it('deletes a viewing and leaves no drift', async () => {
    const season = await twoPasses();
    const { status } = await patch(season, {
      op: 'setViewings',
      key: 's1e1',
      viewings: [view('2026-01-10')],
    });
    expect(status).toBe(200);
    expect(await drifts()).toBe(0);
  });

  it('refuses a start after the finish, a future date and an exact duplicate', async () => {
    const season = await twoPasses();
    const edit = (viewings: object[]) =>
      patch(season, { op: 'setViewings', key: 's1e1', viewings });
    const inverted = await edit([view('2026-01-01', '2026-01-02')]);
    expect(inverted.status).toBe(400);
    expect(inverted.body).toMatchObject({ code: 'invalid_viewing' });
    const future = await edit([view('2026-03-07')]);
    expect(future.status).toBe(400);
    expect(future.body).toMatchObject({ code: 'future_date' });
    const duplicate = await edit([view('2026-01-10'), view('2026-01-10')]);
    expect(duplicate.status).toBe(400);
    expect(duplicate.body).toMatchObject({ code: 'duplicate_viewing' });
    const marked = await patch(season, { op: 'mark', keys: ['s1e3'], date: '2026-03-07' });
    expect(marked.body).toMatchObject({ code: 'future_date' });
    expect(await drifts()).toBe(0);
  });

  it('accepts today and the next day for time zones ahead of the server', async () => {
    const season = addSeason();
    const today = await patch(season, { op: 'mark', keys: ['s1e1'], date: '2026-03-05' });
    expect(today.status).toBe(200);
    const tomorrow = await patch(season, { op: 'mark', keys: ['s1e2'], date: '2026-03-06' });
    expect(tomorrow.status).toBe(200);
  });
});

describe('DELETE /api/seasons/:id/passes/:pass', () => {
  it('deletes the second pass and keeps the first', async () => {
    const season = await twoPasses();
    const { status, body } = await call('DELETE', `/api/seasons/${season}/passes/2`);
    expect(status).toBe(200);
    expect(watchesOf(season)).toEqual({
      s1e1: [view('2026-01-10')],
      s1e2: [view('2026-01-10')],
      s1e3: [view('2026-01-10')],
    });
    expect(body.tracking).toMatchObject({ status: 'completed', rewatches: [] });
    expect(await drifts()).toBe(0);
  });

  it('deletes the first pass, so the rewatch becomes the first time', async () => {
    const season = await twoPasses();
    const { status, body } = await call('DELETE', `/api/seasons/${season}/passes/1`);
    expect(status).toBe(200);
    expect(watchesOf(season)).toEqual({
      s1e1: [view('2026-02-10')],
      s1e2: [view('2026-02-10')],
    });
    expect(body.tracking.status).toBe('in_progress');
    expect(await drifts()).toBe(0);
  });

  it('is taken back by restoring the viewings', async () => {
    const season = await twoPasses();
    const before = watchesOf(season) as Record<string, object[]>;
    await call('DELETE', `/api/seasons/${season}/passes/1`);
    const restored = await patch(season, {
      op: 'restoreViewings',
      episodes: Object.entries(before).map(([key, viewings]) => ({ key, viewings })),
    });
    expect(restored.status).toBe(200);
    expect(watchesOf(season)).toEqual(before);
    expect(await drifts()).toBe(0);
  });

  it('refuses a pass nobody has', async () => {
    const season = await twoPasses();
    const { status, body } = await call('DELETE', `/api/seasons/${season}/passes/3`);
    expect(status).toBe(400);
    expect(body).toMatchObject({ code: 'pass_not_found' });
  });

  it('keeps abandoned viewings and unwatches an episode left with none', async () => {
    const season = addSeason();
    await patch(season, { op: 'mark', keys: ['s1e1', 's1e2'], date: '2026-02-01' });
    await call('POST', `/api/seasons/${season}/restart`);
    await patch(season, { op: 'mark', keys: ['s1e1'], date: '2026-03-01' });
    await call('DELETE', `/api/seasons/${season}/passes/1`);
    expect(watchesOf(season)).toEqual({
      s1e1: [{ ...view('2026-02-01'), abandonedAt: '2026-03-05' }],
      s1e2: [{ ...view('2026-02-01'), abandonedAt: '2026-03-05' }],
    });
    expect(await drifts()).toBe(0);
  });

  it('removes an unknown-date watch', async () => {
    const season = addSeason();
    await patch(season, { op: 'mark', keys: ['s1e1'], date: null });
    const { status } = await call('DELETE', `/api/seasons/${season}/passes/1`);
    expect(status).toBe(200);
    expect(watchesOf(season)).toEqual({});
    expect(await drifts()).toBe(0);
  });
});

describe('DELETE /api/seasons/:id/restart?day=', () => {
  async function twoRestarts(): Promise<number> {
    const season = addSeason();
    await patch(season, { op: 'mark', keys: ['s1e1', 's1e2'], date: '2026-02-01' });
    api.clock.now = new Date('2026-03-01T12:00:00Z');
    await call('POST', `/api/seasons/${season}/restart`);
    await patch(season, { op: 'mark', keys: ['s1e1'], date: '2026-03-02' });
    api.clock.now = new Date('2026-03-04T12:00:00Z');
    await call('POST', `/api/seasons/${season}/restart`);
    return season;
  }

  it('takes back an earlier start over while a later one stands', async () => {
    const season = await twoRestarts();
    const { status } = await call('DELETE', `/api/seasons/${season}/restart?day=2026-03-01`);
    expect(status).toBe(200);
    expect(watchesOf(season)).toEqual({
      s1e1: [{ ...view('2026-03-02'), abandonedAt: '2026-03-04' }, view('2026-02-01')],
      s1e2: [view('2026-02-01')],
    });
    expect(await drifts()).toBe(0);
  });

  it('takes back the latest one by default and refuses a day that was never abandoned', async () => {
    const season = await twoRestarts();
    const none = await call('DELETE', `/api/seasons/${season}/restart?day=2026-03-03`);
    expect(none.body).toMatchObject({ code: 'restart_none' });
    const latest = await call('DELETE', `/api/seasons/${season}/restart`);
    expect(latest.status).toBe(200);
    expect(await drifts()).toBe(0);
  });
});

describe('the rewatch intention', () => {
  it('is removed without leaving a drift', async () => {
    const season = addSeason();
    await patch(season, { op: 'mark', keys: ['s1e1', 's1e2', 's1e3'], date: '2026-01-10' });
    await call('PUT', `/api/seasons/${season}/rewatch-intent`, { wanted: true });
    const { status, body } = await call('PUT', `/api/seasons/${season}/rewatch-intent`, {
      wanted: false,
    });
    expect(status).toBe(200);
    expect(body.tracking.wantsRewatch).toBe(false);
    expect(await drifts()).toBe(0);
  });
});

describe('a season without a catalog', () => {
  async function rewatches(season: number, list: object[]) {
    return api.app.inject({
      method: 'PATCH',
      url: `/api/seasons/${season}`,
      headers,
      payload: { rewatches: list },
    });
  }

  it('refuses a future date, a start after the finish and a duplicate rewatch', async () => {
    const season = addSeason();
    api.db.prepare("UPDATE season_entry SET status = 'completed' WHERE season_id = ?").run(season);
    const future = await rewatches(season, [view('2026-03-07')]);
    expect(future.statusCode).toBe(400);
    expect(future.json()).toMatchObject({ code: 'future_date' });
    const inverted = await rewatches(season, [view('2026-01-01', '2026-01-02')]);
    expect(inverted.json()).toMatchObject({ code: 'invalid_dates' });
    const duplicate = await rewatches(season, [view('2026-01-01'), view('2026-01-01')]);
    expect(duplicate.json()).toMatchObject({ code: 'duplicate_viewing' });
    const ok = await rewatches(season, [view('2026-01-01')]);
    expect(ok.statusCode).toBe(200);
    expect(await drifts()).toBe(0);
  });

  it('refuses a future finish date of the season itself', async () => {
    const season = addSeason();
    const response = await api.app.inject({
      method: 'PATCH',
      url: `/api/seasons/${season}`,
      headers,
      payload: { finishedAt: '2026-03-07' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'future_date' });
  });
});
