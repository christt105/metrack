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
    put: (url: string, payload: unknown) =>
      api.app.inject({ method: 'PUT', url, headers, payload: payload as object }),
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
        'INSERT INTO season_entry (user_id, season_id, status, finished_at, started_at, watched_count) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        user,
        season,
        options.status ?? 'planned',
        options.finishedAt ?? null,
        options.finishedAt ? '2026-01-01' : null,
        options.status === 'completed' ? (options.episodeCount ?? 3) : 0,
      );
  }
  return season;
}

function seriesOf(seasonId: number): number {
  return Number(
    (
      api.db.prepare('SELECT series_id FROM season WHERE id = ?').get(seasonId) as {
        series_id: number;
      }
    ).series_id,
  );
}

function watchesOf(userId: number, seasonId: number): unknown {
  const row = api.db
    .prepare('SELECT watched FROM series_episode_entry WHERE user_id = ? AND series_id = ?')
    .get(userId, seriesOf(seasonId)) as { watched: string } | undefined;
  return row ? JSON.parse(row.watched) : undefined;
}

function entryOf(userId: number, seasonId: number) {
  return api.db
    .prepare(
      'SELECT status, started_at, finished_at, rewatches, watched_count, wants_rewatch FROM season_entry WHERE user_id = ? AND season_id = ?',
    )
    .get(userId, seasonId) as {
    status: string;
    started_at: string | null;
    finished_at: string | null;
    rewatches: string;
    watched_count: number;
    wants_rewatch: number;
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

async function put(client: ReturnType<typeof as>, seasonId: number, body: object) {
  const response = await client.put(`/api/seasons/${seasonId}/rewatch-intent`, body);
  return { status: response.statusCode, body: response.json() as SeasonEpisodesUpdateResponse };
}

const view = (finishedAt: string, startedAt: string | null = finishedAt) => ({
  startedAt,
  finishedAt,
});

describe('PATCH /api/seasons/:id/episodes', () => {
  it('marks episodes with a date, starts the season and bumps the content version', async () => {
    const season = addSeason();
    const before = await versions.current(1);
    const { status, body } = await patch(owner, season, {
      op: 'mark',
      keys: ['s1e1'],
      date: '2026-02-02',
    });
    expect(status).toBe(200);
    expect(body.watchedCount).toBe(1);
    expect(body.episodes[0]).toMatchObject({
      number: 1,
      key: 's1e1',
      watched: true,
      viewings: [view('2026-02-02')],
    });
    expect(body.tracking).toMatchObject({ status: 'in_progress', startedAt: '2026-02-02' });
    expect(watchesOf(1, season)).toEqual({ s1e1: [view('2026-02-02')] });
    expect(entryOf(1, season)).toMatchObject({
      status: 'in_progress',
      started_at: '2026-02-02',
      watched_count: 1,
    });
    expect(await versions.current(1)).toBe(before + 1);
  });

  it('marks with an unknown date as an empty list and adds nothing to a watched episode', async () => {
    const season = addSeason();
    await patch(owner, season, { op: 'mark', keys: ['s1e1', 's1e2'], date: null });
    expect(watchesOf(1, season)).toEqual({ s1e1: [], s1e2: [] });
    await patch(owner, season, { op: 'mark', keys: ['s1e1'], date: '2026-02-03' });
    await patch(owner, season, { op: 'mark', keys: ['s1e1'], date: null });
    expect(watchesOf(1, season)).toEqual({
      s1e1: [{ startedAt: null, finishedAt: null }, view('2026-02-03')],
      s1e2: [],
    });
  });

  it('completes the season on the latest first viewing', async () => {
    const season = addSeason();
    await patch(owner, season, { op: 'mark', keys: ['s1e1', 's1e2'], date: '2026-02-01' });
    const { body } = await patch(owner, season, { op: 'mark', keys: ['s1e3'], date: '2026-02-09' });
    expect(body.tracking).toMatchObject({
      status: 'completed',
      startedAt: '2026-02-01',
      finishedAt: '2026-02-09',
    });
    expect(entryOf(1, season)).toMatchObject({ status: 'completed', watched_count: 3 });
  });

  it('restores the watches on unmark and reopens the season the mark completed', async () => {
    const season = addSeason();
    await patch(owner, season, { op: 'mark', keys: ['s1e1'], date: '2026-02-01' });
    const marked = await patch(owner, season, {
      op: 'mark',
      keys: ['s1e2', 's1e3'],
      date: '2026-02-02',
    });
    expect(marked.body.tracking.status).toBe('completed');
    const { body } = await patch(owner, season, { op: 'unmark', keys: ['s1e2', 's1e3'] });
    expect(watchesOf(1, season)).toEqual({ s1e1: [view('2026-02-01')] });
    expect(body.watchedCount).toBe(1);
    expect(body.tracking).toMatchObject({
      status: 'in_progress',
      startedAt: '2026-02-01',
      finishedAt: null,
    });
    expect(entryOf(1, season)).toMatchObject({ status: 'in_progress', watched_count: 1 });
  });

  it('replaces the viewings of one episode', async () => {
    const season = addSeason();
    const { body } = await patch(owner, season, {
      op: 'setViewings',
      key: 's1e2',
      viewings: [view('2026-04-01', '2026-03-30'), view('2026-02-01')],
    });
    expect(body.episodes[1]?.viewings).toEqual([
      view('2026-02-01'),
      view('2026-04-01', '2026-03-30'),
    ]);
    await patch(owner, season, { op: 'setViewings', key: 's1e2', viewings: [] });
    expect(watchesOf(1, season)).toEqual({ s1e2: [] });
  });

  it('rejects numbers outside the season and invalid viewings', async () => {
    const season = addSeason();
    const out = await patch(owner, season, { op: 'mark', keys: ['s1e4'], date: null });
    expect(out.status).toBe(400);
    expect(out.body).toMatchObject({ code: 'episode_out_of_range' });
    const backwards = await patch(owner, season, {
      op: 'setViewings',
      key: 's1e1',
      viewings: [view('2026-01-01', '2026-02-01')],
    });
    expect(backwards.status).toBe(400);
    const open = await patch(owner, season, {
      op: 'setViewings',
      key: 's1e1',
      viewings: [{ startedAt: '2026-01-01', finishedAt: null }],
    });
    expect(open.status).toBe(400);
    expect((await patch(owner, season, { op: 'mark', keys: ['s1e1'], date: 'soon' })).status).toBe(
      400,
    );
    expect((await patch(owner, season, { op: 'nope' })).status).toBe(400);
    expect((await patch(owner, 9999, { op: 'unmark', keys: ['s1e1'] })).status).toBe(404);
    expect(watchesOf(1, season)).toBeUndefined();
  });

  it('materializes a completed season that records none of its episodes before changing it', async () => {
    const season = addSeason({ status: 'completed', finishedAt: '2026-02-01' });
    const same = await patch(owner, season, { op: 'mark', keys: ['s1e1'], date: null });
    expect(same.body.watchedCount).toBe(3);
    expect(watchesOf(1, season)).toEqual({ s1e1: [], s1e2: [], s1e3: [] });
    const { body } = await patch(owner, season, { op: 'unmark', keys: ['s1e2'] });
    expect(watchesOf(1, season)).toEqual({ s1e1: [], s1e3: [] });
    expect(body).toMatchObject({
      watchedCount: 2,
      tracking: { status: 'in_progress', finishedAt: '2026-02-01' },
    });
    expect(entryOf(1, season).watched_count).toBe(2);
  });

  it('counts a viewing after the finish as a second pass that opens a rewatch only once the user asked for one', async () => {
    const season = addSeason({ status: 'completed', finishedAt: '2026-02-01' });
    const first = await patch(owner, season, { op: 'mark', keys: ['s1e1'], date: '2026-03-01' });
    expect(first.body.tracking.rewatches).toEqual([]);
    expect(watchesOf(1, season)).toEqual({
      s1e1: [{ startedAt: null, finishedAt: null }, view('2026-03-01')],
      s1e2: [],
      s1e3: [],
    });
    const wanted = await put(owner, season, { wanted: true });
    expect(wanted.body.tracking).toMatchObject({ wantsRewatch: true });
    expect(wanted.body.tracking.rewatches).toEqual([{ startedAt: '2026-03-01', finishedAt: null }]);
    await patch(owner, season, { op: 'mark', keys: ['s1e2'], date: '2026-03-02' });
    const closed = await patch(owner, season, { op: 'mark', keys: ['s1e3'], date: '2026-03-04' });
    expect(closed.body.tracking.rewatches).toEqual([view('2026-03-04', '2026-03-01')]);
    expect(closed.body.tracking.wantsRewatch).toBe(false);
    expect(JSON.parse(entryOf(1, season).rewatches)).toEqual([view('2026-03-04', '2026-03-01')]);
    expect(entryOf(1, season).wants_rewatch).toBe(0);
  });

  it('sets the intention to watch again without recording dates and clears it without a trace', async () => {
    const season = addSeason({ status: 'completed', finishedAt: '2026-02-01' });
    const wanted = await put(owner, season, { wanted: true });
    expect(wanted.body.tracking).toEqual({
      status: 'completed',
      startedAt: '2026-01-01',
      finishedAt: '2026-02-01',
      rewatches: [],
      wantsRewatch: true,
    });
    expect(entryOf(1, season).wants_rewatch).toBe(1);
    const cleared = await put(owner, season, { wanted: false });
    expect(cleared.body.tracking).toMatchObject({ wantsRewatch: false, rewatches: [] });
    expect(entryOf(1, season).wants_rewatch).toBe(0);
  });

  it('puts a season completed by hand back as it was after marking and unmarking an episode', async () => {
    const season = addSeason({ status: 'completed', finishedAt: '2026-02-01' });
    const before = entryOf(1, season);
    await patch(owner, season, { op: 'mark', keys: ['s1e1'], date: '2026-03-01' });
    const { body } = await patch(owner, season, { op: 'unmark', keys: ['s1e1'] });
    expect(body.tracking).toMatchObject({
      status: 'completed',
      startedAt: before.started_at,
      finishedAt: '2026-02-01',
      rewatches: [],
      wantsRewatch: false,
    });
    expect(watchesOf(1, season)).toEqual({ s1e1: [], s1e2: [], s1e3: [] });
  });

  it('keeps the start of a season completed by hand before its finish while marking and unmarking a rewatched episode', async () => {
    const season = addSeason({ status: 'completed', finishedAt: '2026-11-18' });
    const marked = await patch(owner, season, { op: 'mark', keys: ['s1e1'], date: '2026-11-23' });
    const { startedAt, finishedAt } = marked.body.tracking;
    expect(startedAt).toBe('2026-01-01');
    expect(finishedAt).toBe('2026-11-18');
    expect(startedAt! <= finishedAt!).toBe(true);
    expect(marked.body.tracking).toMatchObject({ status: 'completed', rewatches: [] });
    const unmarked = await patch(owner, season, { op: 'unmark', keys: ['s1e1'] });
    expect(unmarked.body.tracking).toEqual({
      status: 'completed',
      startedAt: '2026-01-01',
      finishedAt: '2026-11-18',
      rewatches: [],
      wantsRewatch: false,
    });
    expect(entryOf(1, season)).toMatchObject({ status: 'completed', watched_count: 3 });
  });

  it('never changes a dropped season', async () => {
    const season = addSeason({ status: 'dropped' });
    const { body } = await patch(owner, season, {
      op: 'mark',
      keys: ['s1e1', 's1e2', 's1e3'],
      date: '2026-02-01',
    });
    expect(body.tracking).toMatchObject({ status: 'dropped', startedAt: null });
    expect(body.watchedCount).toBe(3);
  });

  it("keeps another user's watches and tracking apart", async () => {
    const season = addSeason();
    await patch(owner, season, { op: 'mark', keys: ['s1e1', 's1e2', 's1e3'], date: '2026-02-01' });
    expect(watchesOf(2, season)).toBeUndefined();
    expect(entryOf(2, season)).toMatchObject({ status: 'planned', watched_count: 0 });
    await patch(normal, season, { op: 'mark', keys: ['s1e2'], date: '2026-02-05' });
    expect(watchesOf(2, season)).toEqual({ s1e2: [view('2026-02-05')] });
    expect(watchesOf(1, season)).toEqual({
      s1e1: [view('2026-02-01')],
      s1e2: [view('2026-02-01')],
      s1e3: [view('2026-02-01')],
    });
    expect(entryOf(1, season).status).toBe('completed');
  });

  describe('with catalogs', () => {
    function catalog(seasonId: number, ids: number[]): void {
      api.db
        .prepare(
          "INSERT INTO season_episodes (season_id, episodes, source, fetched_at, complete) VALUES (?, ?, 'tmdb', ?, 1)",
        )
        .run(
          seasonId,
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
    }

    function secondSeason(seasonId: number): number {
      const id = Number(
        api.db
          .prepare(
            'INSERT INTO season (series_id, number, tmdb_season_number, episode_count) VALUES (?, 2, 2, 2)',
          )
          .run(seriesOf(seasonId)).lastInsertRowid,
      );
      for (const user of [1, 2]) {
        api.db
          .prepare("INSERT INTO season_entry (user_id, season_id, status) VALUES (?, ?, 'planned')")
          .run(user, id);
      }
      return id;
    }

    it('recomputes the other seasons of the series from the same watches in one write', async () => {
      const first = addSeason({ episodeCount: 2 });
      const second = secondSeason(first);
      catalog(first, [101, 102]);
      catalog(second, [201, 202]);
      api.db
        .prepare('INSERT INTO series_episode_entry (user_id, series_id, watched) VALUES (1, ?, ?)')
        .run(
          seriesOf(first),
          JSON.stringify({ '201': [view('2026-05-05')], '202': [view('2026-05-06')] }),
        );
      const { body } = await patch(owner, first, { op: 'mark', keys: ['101'], date: '2026-06-01' });
      expect(body.tracking).toMatchObject({ status: 'in_progress', startedAt: '2026-06-01' });
      expect(entryOf(1, first)).toMatchObject({ status: 'in_progress', watched_count: 1 });
      expect(entryOf(1, second)).toMatchObject({
        status: 'completed',
        started_at: '2026-05-05',
        finished_at: '2026-05-06',
        watched_count: 2,
      });
      expect(entryOf(2, second)).toMatchObject({ status: 'planned', watched_count: 0 });
    });

    it('takes the season dates from the episodes and says so', async () => {
      const season = addSeason({ episodeCount: 2 });
      catalog(season, [101, 102]);
      await patch(owner, season, { op: 'mark', keys: ['101'], date: '2026-06-03' });
      const { body } = await patch(owner, season, {
        op: 'mark',
        keys: ['102'],
        date: '2026-06-09',
      });
      expect(body.datesDerived).toBe(true);
      expect(body.tracking).toMatchObject({
        status: 'completed',
        startedAt: '2026-06-03',
        finishedAt: '2026-06-09',
      });
    });

    it('recomputes the status and dates from what remains after unmarking', async () => {
      const season = addSeason({ episodeCount: 2 });
      catalog(season, [101, 102]);
      await patch(owner, season, { op: 'mark', keys: ['101'], date: '2026-06-03' });
      await patch(owner, season, { op: 'mark', keys: ['102'], date: '2026-06-09' });
      const { body } = await patch(owner, season, { op: 'unmark', keys: ['101'] });
      expect(body.tracking).toMatchObject({
        status: 'in_progress',
        startedAt: '2026-06-09',
        finishedAt: null,
      });
      const gone = await patch(owner, season, { op: 'unmark', keys: ['102'] });
      expect(gone.body.datesDerived).toBe(false);
      expect(gone.body.tracking).toMatchObject({
        status: 'in_progress',
        startedAt: '2026-06-09',
        finishedAt: null,
      });
      expect(gone.body.watchedCount).toBe(0);
    });

    it('does not derive dates from episodes watched on an unknown date', async () => {
      const season = addSeason({ episodeCount: 2 });
      catalog(season, [101, 102]);
      const { body } = await patch(owner, season, { op: 'mark', keys: ['101'], date: null });
      expect(body.datesDerived).toBe(false);
      expect(body.tracking).toMatchObject({ status: 'in_progress', startedAt: null });
    });

    it('refuses keys of another season of the series', async () => {
      const first = addSeason({ episodeCount: 2 });
      const second = secondSeason(first);
      catalog(first, [101, 102]);
      catalog(second, [201, 202]);
      const { status } = await patch(owner, first, { op: 'mark', keys: ['201'], date: null });
      expect(status).toBe(400);
    });
  });
});
