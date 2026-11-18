import { beforeEach, describe, expect, it } from 'vitest';
import type { EpisodeOperation, SeasonEpisodesUpdateResponse } from '@metrack/domain';
import type { Authenticator } from '../src/auth/Authenticator.js';
import type { FetchFn } from '../src/http/FetchFn.js';
import { MemoryContentVersions } from '../src/site/MemoryContentVersions.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';

let api: TestApi;
let users: SqliteUserRepository;
let versions: MemoryContentVersions;

const byHeader: Authenticator = {
  userFor: async (headers) => users.get(Number(headers.get('x-test-user'))),
};

const fetchFn = (async () => new Response('missing', { status: 404 })) as FetchFn;

beforeEach(async () => {
  versions = new MemoryContentVersions();
  api = await createTestApi(fetchFn, {
    scope: new AsyncUserScope(),
    authenticator: byHeader,
    contentVersions: versions,
  });
  users = new SqliteUserRepository(api.db);
  await users.create({ name: 'Normal', email: null });
});

function as(userId: number) {
  const headers = { 'x-test-user': String(userId) };
  return {
    patch: (url: string, payload: unknown) =>
      api.app.inject({ method: 'PATCH', url, headers, payload: payload as object }),
  };
}

const owner = as(1);
const normal = as(2);

function addSeason(options: { status?: string; episodeCount?: number; finishedAt?: string } = {}) {
  const series = Number(
    api.db.prepare('INSERT INTO series (tmdb_id, title) VALUES (4242, ?)').run('Show')
      .lastInsertRowid,
  );
  const season = Number(
    api.db
      .prepare(
        'INSERT INTO season (series_id, number, tmdb_season_number, episode_count) VALUES (?, 1, 1, ?)',
      )
      .run(series, options.episodeCount ?? 3).lastInsertRowid,
  );
  for (const user of [1, 2]) {
    api.db.prepare('INSERT INTO series_entry (user_id, series_id) VALUES (?, ?)').run(user, series);
    api.db
      .prepare(
        'INSERT INTO season_entry (user_id, season_id, status, finished_at, started_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        user,
        season,
        options.status ?? 'planned',
        options.finishedAt ?? null,
        options.finishedAt ? '2026-01-01' : null,
      );
  }
  return season;
}

function watchesOf(userId: number, seasonId: number): unknown {
  const row = api.db
    .prepare('SELECT watched FROM season_episode_entry WHERE user_id = ? AND season_id = ?')
    .get(userId, seasonId) as { watched: string } | undefined;
  return row ? JSON.parse(row.watched) : undefined;
}

function entryOf(userId: number, seasonId: number) {
  return api.db
    .prepare(
      'SELECT status, started_at, finished_at, rewatches, watched_count FROM season_entry WHERE user_id = ? AND season_id = ?',
    )
    .get(userId, seasonId) as {
    status: string;
    started_at: string | null;
    finished_at: string | null;
    rewatches: string;
    watched_count: number;
  };
}

async function patch(
  client: ReturnType<typeof as>,
  seasonId: number,
  body: EpisodeOperation | object,
) {
  const response = await client.patch(`/api/seasons/${seasonId}/episodes`, body);
  return { status: response.statusCode, body: response.json() as SeasonEpisodesUpdateResponse };
}

const view = (finishedAt: string, startedAt: string | null = null) => ({ startedAt, finishedAt });

describe('PATCH /api/seasons/:id/episodes', () => {
  it('marks episodes with a date, starts the season and bumps the content version', async () => {
    const season = addSeason();
    const before = await versions.current(1);
    const { status, body } = await patch(owner, season, {
      op: 'mark',
      numbers: [1],
      date: '2026-02-02',
    });
    expect(status).toBe(200);
    expect(body.watchedCount).toBe(1);
    expect(body.episodes[0]).toMatchObject({
      number: 1,
      watched: true,
      viewings: [view('2026-02-02')],
    });
    expect(body.tracking).toMatchObject({ status: 'in_progress', startedAt: '2026-02-02' });
    expect(watchesOf(1, season)).toEqual({ '1': [view('2026-02-02')] });
    expect(entryOf(1, season)).toMatchObject({
      status: 'in_progress',
      started_at: '2026-02-02',
      watched_count: 1,
    });
    expect(await versions.current(1)).toBe(before + 1);
  });

  it('marks with an unknown date as an empty list and adds nothing to a watched episode', async () => {
    const season = addSeason();
    await patch(owner, season, { op: 'mark', numbers: [1, 2], date: null });
    expect(watchesOf(1, season)).toEqual({ '1': [], '2': [] });
    await patch(owner, season, { op: 'mark', numbers: [1], date: '2026-02-03' });
    await patch(owner, season, { op: 'mark', numbers: [1], date: null });
    expect(watchesOf(1, season)).toEqual({ '1': [view('2026-02-03')], '2': [] });
  });

  it('completes the season on the latest first viewing', async () => {
    const season = addSeason();
    await patch(owner, season, { op: 'mark', numbers: [1, 2], date: '2026-02-01' });
    const { body } = await patch(owner, season, { op: 'mark', numbers: [3], date: '2026-02-09' });
    expect(body.tracking).toMatchObject({
      status: 'completed',
      startedAt: '2026-02-01',
      finishedAt: '2026-02-09',
    });
    expect(entryOf(1, season)).toMatchObject({ status: 'completed', watched_count: 3 });
  });

  it('restores the watches on unmark but keeps the status the mark set', async () => {
    const season = addSeason();
    await patch(owner, season, { op: 'mark', numbers: [1], date: '2026-02-01' });
    const marked = await patch(owner, season, { op: 'mark', numbers: [2, 3], date: '2026-02-02' });
    expect(marked.body.tracking.status).toBe('completed');
    const { body } = await patch(owner, season, { op: 'unmark', numbers: [2, 3] });
    expect(watchesOf(1, season)).toEqual({ '1': [view('2026-02-01')] });
    expect(body.watchedCount).toBe(1);
    expect(body.tracking).toMatchObject({ status: 'completed', finishedAt: '2026-02-02' });
    expect(entryOf(1, season)).toMatchObject({ status: 'completed', watched_count: 1 });
  });

  it('replaces the viewings of one episode', async () => {
    const season = addSeason();
    const { body } = await patch(owner, season, {
      op: 'setViewings',
      number: 2,
      viewings: [view('2026-04-01', '2026-03-30'), view('2026-02-01')],
    });
    expect(body.episodes[1]?.viewings).toEqual([
      view('2026-02-01'),
      view('2026-04-01', '2026-03-30'),
    ]);
    await patch(owner, season, { op: 'setViewings', number: 2, viewings: [] });
    expect(watchesOf(1, season)).toEqual({ '2': [] });
  });

  it('rejects numbers outside the season and invalid viewings', async () => {
    const season = addSeason();
    const out = await patch(owner, season, { op: 'mark', numbers: [4], date: null });
    expect(out.status).toBe(400);
    expect(out.body).toMatchObject({ code: 'episode_out_of_range' });
    const backwards = await patch(owner, season, {
      op: 'setViewings',
      number: 1,
      viewings: [view('2026-01-01', '2026-02-01')],
    });
    expect(backwards.status).toBe(400);
    const open = await patch(owner, season, {
      op: 'setViewings',
      number: 1,
      viewings: [{ startedAt: '2026-01-01', finishedAt: null }],
    });
    expect(open.status).toBe(400);
    expect((await patch(owner, season, { op: 'mark', numbers: [1], date: 'soon' })).status).toBe(
      400,
    );
    expect((await patch(owner, season, { op: 'nope' })).status).toBe(400);
    expect((await patch(owner, 9999, { op: 'unmark', numbers: [1] })).status).toBe(404);
    expect(watchesOf(1, season)).toBeUndefined();
  });

  it('materializes a completed season without watches before changing it', async () => {
    const season = addSeason({ status: 'completed', finishedAt: '2026-02-01' });
    const same = await patch(owner, season, { op: 'mark', numbers: [1], date: null });
    expect(same.body.watchedCount).toBe(3);
    expect(watchesOf(1, season)).toBeUndefined();
    const { body } = await patch(owner, season, { op: 'unmark', numbers: [2] });
    expect(watchesOf(1, season)).toEqual({ '1': [], '3': [] });
    expect(body).toMatchObject({ watchedCount: 2, tracking: { status: 'completed' } });
    expect(entryOf(1, season).watched_count).toBe(2);
  });

  it('opens a rewatch from a viewing after the finish and closes it once every episode was seen again', async () => {
    const season = addSeason({ status: 'completed', finishedAt: '2026-02-01' });
    const opened = await patch(owner, season, { op: 'mark', numbers: [1], date: '2026-03-01' });
    expect(opened.body.tracking.rewatches).toEqual([{ startedAt: '2026-03-01', finishedAt: null }]);
    expect(watchesOf(1, season)).toEqual({ '1': [view('2026-03-01')], '2': [], '3': [] });
    await patch(owner, season, { op: 'mark', numbers: [2], date: '2026-03-02' });
    const closed = await patch(owner, season, { op: 'mark', numbers: [3], date: '2026-03-04' });
    expect(closed.body.tracking.rewatches).toEqual([view('2026-03-04', '2026-03-01')]);
    expect(JSON.parse(entryOf(1, season).rewatches)).toEqual([view('2026-03-04', '2026-03-01')]);
  });

  it('never changes a dropped season', async () => {
    const season = addSeason({ status: 'dropped' });
    const { body } = await patch(owner, season, {
      op: 'mark',
      numbers: [1, 2, 3],
      date: '2026-02-01',
    });
    expect(body.tracking).toMatchObject({ status: 'dropped', startedAt: null });
    expect(body.watchedCount).toBe(3);
  });

  it("keeps another user's watches and tracking apart", async () => {
    const season = addSeason();
    await patch(owner, season, { op: 'mark', numbers: [1, 2, 3], date: '2026-02-01' });
    expect(watchesOf(2, season)).toBeUndefined();
    expect(entryOf(2, season)).toMatchObject({ status: 'planned', watched_count: 0 });
    await patch(normal, season, { op: 'mark', numbers: [2], date: '2026-02-05' });
    expect(watchesOf(2, season)).toEqual({ '2': [view('2026-02-05')] });
    expect(watchesOf(1, season)).toEqual({
      '1': [view('2026-02-01')],
      '2': [view('2026-02-01')],
      '3': [view('2026-02-01')],
    });
    expect(entryOf(1, season).status).toBe('completed');
  });
});
