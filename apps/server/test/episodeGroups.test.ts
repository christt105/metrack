import { beforeEach, describe, expect, it } from 'vitest';
import type { Season, Series } from '@metrack/domain';
import type { Authenticator } from '../src/auth/Authenticator.js';
import { SqliteUserRepository } from '../src/storage/sqlite/SqliteUserRepository.js';
import { AsyncUserScope } from '../src/users/AsyncUserScope.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';
import { pathFetch } from './support/pathFetch.js';
import {
  DANDADAN_ID,
  DANDADAN_SEASONS_GROUP,
  danDaDanDetails,
  danDaDanGroups,
  danDaDanSeasonsGroup,
  FRIEREN_COURS_GROUP,
  FRIEREN_ID,
  FRIEREN_SEASONS_GROUP,
  frierenDetails,
  frierenGroups,
  frierenSeasonsGroup,
  TMDB,
} from './support/tmdbGroupFixtures.js';

let api: TestApi;
let users: SqliteUserRepository;
let routes: Record<string, object>;
let net: ReturnType<typeof pathFetch>;

const byHeader: Authenticator = {
  userFor: async (headers) => users.get(Number(headers.get('x-test-user'))),
};

beforeEach(async () => {
  routes = {
    [`${TMDB}/tv/${FRIEREN_ID}`]: frierenDetails(),
    [`${TMDB}/tv/${FRIEREN_ID}/episode_groups`]: frierenGroups(),
    [`${TMDB}/tv/episode_group/${FRIEREN_SEASONS_GROUP}`]: frierenSeasonsGroup(),
    [`${TMDB}/tv/${DANDADAN_ID}`]: danDaDanDetails(),
    [`${TMDB}/tv/${DANDADAN_ID}/episode_groups`]: danDaDanGroups(),
    [`${TMDB}/tv/episode_group/${DANDADAN_SEASONS_GROUP}`]: danDaDanSeasonsGroup(),
  };
  net = pathFetch(routes);
  api = await createTestApi(net.fetch, {
    scope: new AsyncUserScope(),
    authenticator: byHeader,
  });
  users = new SqliteUserRepository(api.db);
  await users.create({ name: 'Normal', email: null });
  await users.create({ name: 'Other', email: null });
});

function as(userId: number) {
  const headers = { 'x-test-user': String(userId) };
  return {
    get: (url: string) => api.app.inject({ method: 'GET', url, headers }),
    post: (url: string, payload: object) =>
      api.app.inject({ method: 'POST', url, headers, payload }),
    patch: (url: string, payload: object) =>
      api.app.inject({ method: 'PATCH', url, headers, payload }),
    put: (url: string, payload: object) => api.app.inject({ method: 'PUT', url, headers, payload }),
  };
}

const owner = as(1);
const normal = as(2);
const other = as(3);

async function addSeries(client: ReturnType<typeof as>, tmdbId: number): Promise<number> {
  const response = await client.post('/api/titles', { type: 'series', externalId: String(tmdbId) });
  expect(response.statusCode).toBe(201);
  return response.json().id;
}

async function seriesOf(client: ReturnType<typeof as>, id: number) {
  return (await client.get(`/api/series/${id}`)).json() as Series & { seasons: Season[] };
}

describe('seasons that follow a TMDB episode group', () => {
  it('applies the only Seasons group when a season TMDB does not know exists', async () => {
    const seriesId = (
      await owner.post('/api/series', { title: 'Frieren', tmdbId: FRIEREN_ID })
    ).json().id;
    await owner.post('/api/seasons', {
      seriesId,
      number: 1,
      firstAirDate: '2023-09-29',
      episodeCount: 38,
    });
    const created = await owner.post('/api/seasons', {
      seriesId,
      number: 2,
      firstAirDate: '2026-01-16',
      episodeCount: 10,
    });
    expect(created.statusCode).toBe(201);

    const series = await seriesOf(owner, seriesId);
    expect(series.tmdbEpisodeGroup).toBe(FRIEREN_SEASONS_GROUP);
    expect(
      series.seasons.map((s) => [s.number, s.tmdbSeasonNumber, s.title, s.episodeCount]),
    ).toEqual([
      [1, 1, 'Season 1', 28],
      [2, 2, null, 10],
    ]);
    expect(created.json().tmdbSeasonNumber).toBe(2);
  });

  it('lets a normal user add season 2 of a series TMDB knows as one season, with Jellyfin out of the picture', async () => {
    const seriesId = await addSeries(normal, DANDADAN_ID);
    expect((await seriesOf(normal, seriesId)).seasons).toHaveLength(1);

    const created = await normal.post('/api/seasons', { seriesId, number: 2 });
    expect(created.statusCode).toBe(201);

    const series = await seriesOf(normal, seriesId);
    expect(series.tmdbEpisodeGroup).toBe(DANDADAN_SEASONS_GROUP);
    expect(series.seasons.map((s) => [s.number, s.tmdbSeasonNumber, s.episodeCount])).toEqual([
      [1, 1, 12],
      [2, 2, 12],
    ]);
    expect(series.seasons[1]?.firstAirDate).toBe('2025-07-03');
  });

  it('applies the group to a series other users have too, as provider data', async () => {
    const seriesId = await addSeries(other, DANDADAN_ID);
    expect(await addSeries(normal, DANDADAN_ID)).toBe(seriesId);
    await normal.post('/api/seasons', { seriesId, number: 2 });
    expect((await seriesOf(other, seriesId)).tmdbEpisodeGroup).toBe(DANDADAN_SEASONS_GROUP);
  });

  it('unlinks the seasons only other users have, so their next refresh links them by the new ordering', async () => {
    const seriesId = await addSeries(other, DANDADAN_ID);
    expect(await addSeries(normal, DANDADAN_ID)).toBe(seriesId);
    const first = (await seriesOf(normal, seriesId)).seasons[0];
    expect(
      (
        await api.app.inject({
          method: 'DELETE',
          url: `/api/seasons/${first?.id}`,
          headers: { 'x-test-user': '2' },
        })
      ).statusCode,
    ).toBe(204);

    await normal.post('/api/seasons', { seriesId, number: 2 });
    expect((await seriesOf(other, seriesId)).seasons[0]?.tmdbSeasonNumber).toBeNull();

    await other.post(`/api/metadata/series/${seriesId}/refresh`, {});
    const linked = (await seriesOf(other, seriesId)).seasons[0];
    expect([linked?.tmdbSeasonNumber, linked?.episodeCount]).toEqual([1, 12]);
  });

  it('leaves the ordering alone when several Seasons groups have the season', async () => {
    routes[`${TMDB}/tv/${DANDADAN_ID}/episode_groups`] = {
      id: DANDADAN_ID,
      results: [
        { id: DANDADAN_SEASONS_GROUP, name: 'Seasons', type: 6, episode_count: 24, group_count: 2 },
        { id: 'second', name: 'Production', type: 6, episode_count: 24, group_count: 2 },
      ],
    };
    routes[`${TMDB}/tv/episode_group/second`] = danDaDanSeasonsGroup();
    const seriesId = await addSeries(normal, DANDADAN_ID);
    await normal.post('/api/seasons', { seriesId, number: 2 });

    const series = await seriesOf(normal, seriesId);
    expect(series.tmdbEpisodeGroup).toBeNull();
    expect(series.seasons[1]?.tmdbSeasonNumber).toBeNull();
    const options = (await normal.get(`/api/series/${seriesId}/episode-groups`)).json();
    expect(options.suggested).toBeNull();
    expect(options.groups.map((g: { id: string }) => g.id)).toEqual([
      DANDADAN_SEASONS_GROUP,
      'second',
    ]);
  });

  it('does not look for groups when TMDB knows every season', async () => {
    const seriesId = await addSeries(normal, DANDADAN_ID);
    expect((await normal.post(`/api/metadata/series/${seriesId}/refresh`, {})).statusCode).toBe(
      200,
    );
    expect((await seriesOf(normal, seriesId)).tmdbEpisodeGroup).toBeNull();
    expect(net.calls.some((call) => call.includes('episode_group'))).toBe(false);
  });

  it('suggests the group in the options when it could not be applied yet', async () => {
    delete routes[`${TMDB}/tv/episode_group/${FRIEREN_SEASONS_GROUP}`];
    const seriesId = (
      await owner.post('/api/series', { title: 'Frieren', tmdbId: FRIEREN_ID })
    ).json().id;
    await owner.post('/api/seasons', { seriesId, number: 2, firstAirDate: '2026-01-16' });
    expect((await seriesOf(owner, seriesId)).tmdbEpisodeGroup).toBeNull();

    routes[`${TMDB}/tv/episode_group/${FRIEREN_SEASONS_GROUP}`] = frierenSeasonsGroup();
    const options = (await owner.get(`/api/series/${seriesId}/episode-groups`)).json();
    expect(options).toMatchObject({ current: null, suggested: FRIEREN_SEASONS_GROUP });
    expect(options.groups).toContainEqual({
      id: FRIEREN_COURS_GROUP,
      name: 'Cours',
      type: 7,
      groupCount: 3,
      episodeCount: 38,
    });
  });
});

describe('changing the season ordering', () => {
  async function sharedFrieren(): Promise<number> {
    const seriesId = (
      await owner.post('/api/series', { title: 'Frieren', tmdbId: FRIEREN_ID })
    ).json().id;
    expect(await addSeries(normal, FRIEREN_ID)).toBe(seriesId);
    return seriesId;
  }

  it('refuses a normal user on a series other users have', async () => {
    const seriesId = await sharedFrieren();
    const refused = await normal.put(`/api/series/${seriesId}/season-ordering`, {
      episodeGroup: FRIEREN_SEASONS_GROUP,
    });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().code).toBe('catalog_shared');
    const forced = await normal.put(`/api/series/${seriesId}/season-ordering?forAll=true`, {
      episodeGroup: FRIEREN_SEASONS_GROUP,
    });
    expect(forced.statusCode).toBe(409);
  });

  it('lets the owner change it for everyone only when asked to', async () => {
    const seriesId = await sharedFrieren();
    const plain = await owner.put(`/api/series/${seriesId}/season-ordering`, {
      episodeGroup: FRIEREN_SEASONS_GROUP,
    });
    expect(plain.statusCode).toBe(409);

    const forced = await owner.put(`/api/series/${seriesId}/season-ordering?forAll=true`, {
      episodeGroup: FRIEREN_SEASONS_GROUP,
    });
    expect(forced.statusCode).toBe(200);
    expect(forced.json().tmdbEpisodeGroup).toBe(FRIEREN_SEASONS_GROUP);
    expect((await seriesOf(normal, seriesId)).tmdbEpisodeGroup).toBe(FRIEREN_SEASONS_GROUP);
  });

  it('lets a user change it when nobody else has the series, and relinks the seasons', async () => {
    const seriesId = await addSeries(normal, FRIEREN_ID);
    await normal.post('/api/seasons', { seriesId, number: 2, firstAirDate: '2026-01-16' });
    expect((await seriesOf(normal, seriesId)).tmdbEpisodeGroup).toBe(FRIEREN_SEASONS_GROUP);

    const cleared = await normal.put(`/api/series/${seriesId}/season-ordering`, {
      episodeGroup: null,
    });
    expect(cleared.statusCode).toBe(200);
    const series = await seriesOf(normal, seriesId);
    expect(series.seasons.find((s) => s.number === 1)?.tmdbSeasonNumber).toBe(1);

    const cours = await normal.put(`/api/series/${seriesId}/season-ordering`, {
      episodeGroup: 'missing',
    });
    expect(cours.statusCode).toBe(400);
    expect(cours.json().code).toBe('unknown_episode_group');
  });

  it('rejects a series that is not linked to TMDB', async () => {
    const seriesId = (await owner.post('/api/series', { title: 'Local' })).json().id;
    const response = await owner.put(`/api/series/${seriesId}/season-ordering`, {
      episodeGroup: 'x',
    });
    expect(response.json().code).toBe('no_tmdb_id');
  });
});

describe('reorganizing the seasons when the ordering changes', () => {
  const ordering = (client: ReturnType<typeof as>, seriesId: number, group: string | null) =>
    client.put(`/api/series/${seriesId}/season-ordering`, { episodeGroup: group });

  const summary = (series: Series & { seasons: Season[] }) =>
    series.seasons.map((s) => [s.number, s.tmdbSeasonNumber, s.episodeCount, s.status]);

  async function dandadanOnRegular(): Promise<number> {
    const seriesId = await addSeries(normal, DANDADAN_ID);
    expect(summary(await seriesOf(normal, seriesId))).toEqual([[1, 1, 24, 'planned']]);
    return seriesId;
  }

  it('creates the seasons the new ordering has and the series lacks, and relinks the rest', async () => {
    const seriesId = await dandadanOnRegular();
    expect((await ordering(normal, seriesId, DANDADAN_SEASONS_GROUP)).statusCode).toBe(200);
    const series = await seriesOf(normal, seriesId);
    expect(summary(series)).toEqual([
      [1, 1, 12, 'planned'],
      [2, 2, 12, 'planned'],
    ]);
    expect(series.seasons[1]?.firstAirDate).toBe('2025-07-03');
  });

  it('drops the cached episode catalogs of the series and fetches them again', async () => {
    const seriesId = await dandadanOnRegular();
    const season = (await seriesOf(normal, seriesId)).seasons[0] as Season;
    api.db
      .prepare(
        "INSERT INTO season_episodes (season_id, episodes, source, fetched_at) VALUES (?, '[]', 'tmdb', 'now')",
      )
      .run(season.id);
    await ordering(normal, seriesId, DANDADAN_SEASONS_GROUP);
    const rows = api.db.prepare('SELECT episodes FROM season_episodes ORDER BY season_id').all();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.episodes !== '[]')).toBe(true);
  });

  it("derives the acting user's season entries again from their watches", async () => {
    const seriesId = await dandadanOnRegular();
    const day = (finishedAt: string) => ({ startedAt: finishedAt, finishedAt });
    api.db
      .prepare('INSERT INTO series_episode_entry (user_id, series_id, watched) VALUES (2, ?, ?)')
      .run(
        seriesId,
        JSON.stringify({
          s1e1: [day('2026-03-01')],
          s1e2: [day('2026-03-02')],
          s2e1: [day('2026-03-05')],
        }),
      );
    await ordering(normal, seriesId, DANDADAN_SEASONS_GROUP);
    const entries = api.db
      .prepare(
        'SELECT e.status, e.started_at, e.watched_count FROM season_entry e JOIN season s ON s.id = e.season_id WHERE e.user_id = 2 AND s.series_id = ? ORDER BY s.number',
      )
      .all(seriesId);
    expect(entries).toEqual([
      { status: 'in_progress', started_at: '2026-03-01', watched_count: 2 },
      { status: 'in_progress', started_at: '2026-03-05', watched_count: 1 },
    ]);
  });

  it('does not touch what the user watched of the series', async () => {
    const seriesId = await dandadanOnRegular();
    const watched = JSON.stringify({ '123': [], s1e4: [] });
    api.db
      .prepare('INSERT INTO series_episode_entry (user_id, series_id, watched) VALUES (2, ?, ?)')
      .run(seriesId, watched);
    await ordering(normal, seriesId, DANDADAN_SEASONS_GROUP);
    expect(api.db.prepare('SELECT watched FROM series_episode_entry').get()).toEqual({ watched });
  });

  async function dandadanWithSpecialSeason(): Promise<{ seriesId: number; extra: Season }> {
    const seriesId = await dandadanOnRegular();
    expect((await normal.post('/api/seasons', { seriesId, number: 5 })).statusCode).toBe(201);
    const series = await seriesOf(normal, seriesId);
    expect(series.tmdbEpisodeGroup).toBeNull();
    return { seriesId, extra: series.seasons[1] as Season };
  }

  it('deletes a stored season the new ordering lacks when nobody entered anything in it', async () => {
    const { seriesId } = await dandadanWithSpecialSeason();
    expect((await ordering(normal, seriesId, DANDADAN_SEASONS_GROUP)).statusCode).toBe(200);
    expect(summary(await seriesOf(normal, seriesId))).toEqual([
      [1, 1, 12, 'planned'],
      [2, 2, 12, 'planned'],
    ]);
    expect(api.db.prepare('SELECT COUNT(*) AS n FROM season').get()).toEqual({ n: 2 });
  });

  it('keeps it unlinked when the user rated it', async () => {
    const { seriesId, extra } = await dandadanWithSpecialSeason();
    await normal.patch(`/api/seasons/${extra.id}`, { rating: 6 });
    await ordering(normal, seriesId, DANDADAN_SEASONS_GROUP);
    expect(summary(await seriesOf(normal, seriesId))).toEqual([
      [1, 1, 12, 'planned'],
      [2, 2, 12, 'planned'],
      [5, null, null, 'planned'],
    ]);
  });

  it('keeps it when it is marked as watched', async () => {
    const { seriesId, extra } = await dandadanWithSpecialSeason();
    await normal.patch(`/api/seasons/${extra.id}`, { status: 'completed' });
    await ordering(normal, seriesId, DANDADAN_SEASONS_GROUP);
    expect((await seriesOf(normal, seriesId)).seasons.map((s) => s.number)).toEqual([1, 2, 5]);
  });

  describe('going back to the regular seasons', () => {
    async function onGroup(): Promise<{ seriesId: number; second: Season }> {
      const seriesId = await dandadanOnRegular();
      await ordering(normal, seriesId, DANDADAN_SEASONS_GROUP);
      const second = (await seriesOf(normal, seriesId)).seasons[1] as Season;
      return { seriesId, second };
    }

    function recordEpisode(seriesId: number, season: Season): void {
      api.db
        .prepare(
          "INSERT INTO season_episodes (season_id, episodes, source, fetched_at) VALUES (?, ?, 'tmdb', 'now')",
        )
        .run(
          season.id,
          JSON.stringify([{ number: 1, tmdbId: 777, title: 'E', airDate: '2025-07-03' }]),
        );
      api.db
        .prepare('INSERT INTO series_episode_entry (user_id, series_id, watched) VALUES (2, ?, ?)')
        .run(seriesId, JSON.stringify({ '777': [] }));
    }

    const progress = (season: Season, status: string) =>
      api.db
        .prepare(
          'UPDATE season_entry SET status = ?, started_at = ?, finished_at = ?, watched_count = 1 WHERE season_id = ? AND user_id = 2',
        )
        .run(status, '2026-01-01', status === 'completed' ? '2026-01-02' : null, season.id);

    it('leaves exactly the regular seasons when only watched episodes filled the extra ones', async () => {
      const { seriesId, second } = await onGroup();
      recordEpisode(seriesId, second);
      progress(second, 'completed');
      expect((await ordering(normal, seriesId, null)).statusCode).toBe(200);
      expect(summary(await seriesOf(normal, seriesId))).toEqual([[1, 1, 24, 'planned']]);
    });

    it('keeps an extra season holding a status the episodes do not explain', async () => {
      const { seriesId, second } = await onGroup();
      recordEpisode(seriesId, second);
      progress(second, 'completed');
      api.db
        .prepare('UPDATE series_episode_entry SET watched = ?')
        .run(JSON.stringify({ '999': [] }));
      await ordering(normal, seriesId, null);
      expect((await seriesOf(normal, seriesId)).seasons.map((s) => s.number)).toEqual([1, 2]);
    });

    it('keeps an extra season the user rated even with episodes recorded', async () => {
      const { seriesId, second } = await onGroup();
      recordEpisode(seriesId, second);
      await normal.patch(`/api/seasons/${second.id}`, { rating: 6 });
      await ordering(normal, seriesId, null);
      expect((await seriesOf(normal, seriesId)).seasons.map((s) => s.number)).toEqual([1, 2]);
    });
  });

  it('keeps it when another user has data in it', async () => {
    const seriesId = await addSeries(owner, DANDADAN_ID);
    expect((await owner.post('/api/seasons', { seriesId, number: 5 })).statusCode).toBe(201);
    const extra = (await seriesOf(owner, seriesId)).seasons[1] as Season;
    api.db.prepare('INSERT INTO series_entry (user_id, series_id) VALUES (2, ?)').run(seriesId);
    api.db
      .prepare(
        "INSERT INTO season_entry (user_id, season_id, finished_at) VALUES (2, ?, '2026-02-01')",
      )
      .run(extra.id);
    const forced = await owner.put(`/api/series/${seriesId}/season-ordering?forAll=true`, {
      episodeGroup: DANDADAN_SEASONS_GROUP,
    });
    expect(forced.statusCode).toBe(200);
    expect((await seriesOf(owner, seriesId)).seasons.map((s) => s.number)).toEqual([1, 2, 5]);
  });
});

describe('editing shared catalog fields as the owner', () => {
  it('changes a season number for every user only with forAll, and only for the owner', async () => {
    const seriesId = await addSeries(owner, FRIEREN_ID);
    await addSeries(normal, FRIEREN_ID);
    const season = (await seriesOf(owner, seriesId)).seasons[0] as Season;

    const plain = await owner.patch(`/api/seasons/${season.id}`, { tmdbSeasonNumber: 5 });
    expect(plain.statusCode).toBe(409);
    const byNormal = await normal.patch(`/api/seasons/${season.id}?forAll=true`, {
      tmdbSeasonNumber: 5,
    });
    expect(byNormal.statusCode).toBe(409);

    const forced = await owner.patch(`/api/seasons/${season.id}?forAll=true`, {
      tmdbSeasonNumber: 5,
    });
    expect(forced.statusCode).toBe(200);
    expect(forced.json().tmdbSeasonNumber).toBe(5);
    expect((await normal.get(`/api/seasons/${season.id}`)).json().tmdbSeasonNumber).toBe(5);
  });
});

describe('adding seasons', () => {
  it('lets a normal user add a season to a series linked to TMDB but not to one without it', async () => {
    const linked = await addSeries(normal, DANDADAN_ID);
    const local = (await owner.post('/api/series', { title: 'Local', tvdbId: 5 })).json().id;
    api.db.prepare('INSERT INTO series_entry (user_id, series_id) VALUES (2, ?)').run(local);

    expect((await normal.post('/api/seasons', { seriesId: linked, number: 7 })).statusCode).toBe(
      201,
    );
    const refused = await normal.post('/api/seasons', { seriesId: local, number: 1 });
    expect(refused.statusCode).toBe(403);
    expect(refused.json().code).toBe('trusted_only');
  });

  it('keeps refusing normal users the other hand-added items', async () => {
    expect((await normal.post('/api/series', { title: 'Local' })).statusCode).toBe(403);
  });
});
