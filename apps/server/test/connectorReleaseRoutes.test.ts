import { describe, expect, it } from 'vitest';
import type { AlertUser } from '../src/alerts/AlertUser.js';
import type { ReconcileSeasonsRequest } from '../src/alerts/ReconcileSeasonsRequest.js';
import type { ReconcileSeasonsResponse } from '../src/alerts/ReconcileSeasonsResponse.js';
import type { RecordAlertsRequest } from '../src/alerts/RecordAlertsRequest.js';
import type { RecordAlertsResponse } from '../src/alerts/RecordAlertsResponse.js';
import type { ReleaseState } from '../src/alerts/ReleaseState.js';
import { emptyMovie, emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import { NO_SETTINGS } from '../src/users/NO_SETTINGS.js';
import { connectorHarness } from './support/connectorHarness.js';

async function harnessWithTopics() {
  const harness = await connectorHarness();
  await harness.repositories.settings.save(2, {
    ...NO_SETTINGS,
    jellyfinUser: 'friend-jf',
    ntfyTopic: 'friend-topic',
  });
  await harness.repositories.settings.save(3, { ...NO_SETTINGS, ntfyTopic: 'nojelly-topic' });
  return harness;
}

const RELEASE: ReconcileSeasonsRequest['release'] = {
  posterUrl: null,
  numberOfSeasons: 2,
  seasons: [
    { number: 1, name: 'One', overview: null, airDate: '2021-01-08', episodeCount: 5 },
    { number: 2, name: 'Two', overview: 'New', airDate: '2026-10-23', episodeCount: 8 },
  ],
  nextEpisode: { seasonNumber: 2, episodeNumber: 1, airDate: '2026-10-23' },
  flatrateEs: false,
};

describe('release alert routes: access', () => {
  const routes = [
    ['GET', '/api/connector/alert-users'],
    ['GET', '/api/connector/users/2/release-state'],
    ['POST', '/api/connector/users/2/seasons'],
    ['POST', '/api/connector/users/2/release-alerts'],
  ] as const;

  it('need a token: a browser session gets 403', async () => {
    const { app, cookieFor } = await harnessWithTopics();
    for (const [method, url] of routes) {
      const response = await app.inject({ method, url, headers: { cookie: await cookieFor(1) } });
      expect(response.statusCode, url).toBe(403);
      expect(response.json(), url).toMatchObject({ code: 'token_required' });
    }
  });

  it('lets a write token act only on its own user and a read token not write', async () => {
    const { createToken, call } = await harnessWithTopics();
    const write = (await createToken(2, 'write')).secret;
    expect((await call('GET', '/api/connector/users/2/release-state', write)).statusCode).toBe(200);
    const other = await call('GET', '/api/connector/users/3/release-state', write);
    expect(other.statusCode).toBe(403);
    expect(other.json()).toMatchObject({ code: 'connector_other_user' });
    expect(
      (await call('POST', '/api/connector/users/3/release-alerts', write, { alerts: [] }))
        .statusCode,
    ).toBe(403);

    const read = (await createToken(2, 'read')).secret;
    expect((await call('GET', '/api/connector/users/2/release-state', read)).statusCode).toBe(200);
    expect(
      (await call('POST', '/api/connector/users/2/release-alerts', read, { alerts: [] }))
        .statusCode,
    ).toBe(403);
  });

  it('answers 404 for a user without an ntfy topic', async () => {
    const { createToken, call } = await harnessWithTopics();
    const { secret } = await createToken(1, 'connector');
    for (const [method, url] of [
      ['GET', '/api/connector/users/1/release-state'],
      ['GET', '/api/connector/users/99/release-state'],
    ] as const) {
      expect((await call(method, url, secret)).statusCode, url).toBe(404);
    }
  });
});

describe('GET /api/connector/alert-users', () => {
  it('lists every user with an ntfy topic to a connector token, only the own one to a write token', async () => {
    const { createToken, call } = await harnessWithTopics();
    const connector = (await createToken(1, 'connector')).secret;
    const all = await call('GET', '/api/connector/alert-users', connector);
    expect(all.json<AlertUser[]>()).toEqual([
      { id: 2, name: 'Friend' },
      { id: 3, name: 'Nojelly' },
    ]);
    const write = (await createToken(2, 'write')).secret;
    const own = await call('GET', '/api/connector/alert-users', write);
    expect(own.json<AlertUser[]>().map((user) => user.id)).toEqual([2]);
  });
});

describe('GET /api/connector/users/{id}/release-state', () => {
  it('returns the followed titles with a TMDB id, the recorded alert keys and the topic of that user only', async () => {
    const { createToken, call, scope, repositories } = await harnessWithTopics();
    const { secret } = await createToken(1, 'connector');
    const { movies, series, releaseAlerts } = repositories;
    const ids = await scope.run(2, async () => {
      const lupin = await series.create({
        ...emptySeries(),
        tmdbId: 10,
        title: 'Lupin',
        follow: true,
      });
      await series.create({ ...emptySeries(), tmdbId: 11, title: 'Not followed' });
      await series.create({ ...emptySeries(), title: 'No TMDB id', follow: true });
      const dune = await movies.create({
        ...emptyMovie(),
        tmdbId: 20,
        title: 'Dune',
        follow: true,
      });
      await releaseAlerts.record({
        subjectType: 'movie',
        subjectId: dune.id,
        kind: 'releases_today',
        title: 'Dune',
        message: 'Today',
        sentAt: '2026-11-14T09:00:00Z',
      });
      return { lupin: lupin.id, dune: dune.id };
    });
    await scope.run(1, () =>
      series.create({ ...emptySeries(), tmdbId: 12, title: 'Owner show', follow: true }),
    );

    const response = await call('GET', '/api/connector/users/2/release-state', secret);
    expect(response.statusCode).toBe(200);
    expect(response.json<ReleaseState>()).toEqual({
      ntfyTopic: 'friend-topic',
      series: [{ id: ids.lupin, tmdbId: 10, title: 'Lupin' }],
      movies: [{ id: ids.dune, tmdbId: 20, title: 'Dune' }],
      alerts: [{ subjectType: 'movie', subjectId: ids.dune, kind: 'releases_today' }],
    });
  });

  it('reads with a fixed number of queries however many titles are followed', async () => {
    const { createToken, call, scope, repositories, db } = await harnessWithTopics();
    const { secret } = await createToken(1, 'connector');
    await call('GET', '/api/connector/users/2/release-state', secret);
    const readsFor = async (count: number): Promise<number> => {
      await scope.run(2, async () => {
        for (let i = 0; i < count; i += 1) {
          await repositories.series.create({
            ...emptySeries(),
            tmdbId: 1000 + i + Math.floor(Math.random() * 1e6),
            title: `Show ${i}`,
            follow: true,
          });
        }
      });
      let statements = 0;
      const prepare = db.prepare.bind(db);
      db.prepare = ((sql: string) => {
        statements += 1;
        return prepare(sql);
      }) as typeof db.prepare;
      await call('GET', '/api/connector/users/2/release-state', secret);
      db.prepare = prepare;
      return statements;
    };
    const few = await readsFor(2);
    const many = await readsFor(150);
    expect(many).toBe(few);
  });
});

describe('POST /api/connector/users/{id}/seasons', () => {
  it('creates the announced seasons, returns them with their ids and does not duplicate them', async () => {
    const { createToken, call, scope, repositories } = await harnessWithTopics();
    const { secret } = await createToken(1, 'connector');
    const seriesId = await scope.run(2, async () => {
      const show = await repositories.series.create({
        ...emptySeries(),
        tmdbId: 10,
        title: 'Lupin',
        follow: true,
      });
      await repositories.seasons.create({
        ...emptySeason(),
        seriesId: show.id,
        number: 1,
        tmdbSeasonNumber: 1,
        firstAirDate: '2021-01-08',
      });
      return show.id;
    });
    const body: ReconcileSeasonsRequest = { seriesId, release: RELEASE, today: '2026-10-22' };

    const first = await call('POST', '/api/connector/users/2/seasons', secret, body);
    expect(first.statusCode).toBe(200);
    const created = first.json<ReconcileSeasonsResponse>().seasons;
    expect(created.map((r) => [r.season.number, r.airDate, r.created])).toEqual([
      [1, '2021-01-08', false],
      [2, '2026-10-23', true],
    ]);
    expect(created[1]?.season.id).toBeGreaterThan(0);

    const second = await call('POST', '/api/connector/users/2/seasons', secret, body);
    expect(second.json<ReconcileSeasonsResponse>().seasons.map((r) => r.created)).toEqual([
      false,
      false,
    ]);
    expect(await scope.run(2, () => repositories.seasons.listBySeries(seriesId))).toHaveLength(2);
  });

  it('answers 404 for a series the user does not have and 400 for a malformed body', async () => {
    const { createToken, call, scope, repositories } = await harnessWithTopics();
    const { secret } = await createToken(1, 'connector');
    const ownerSeries = await scope.run(1, () =>
      repositories.series.create({ ...emptySeries(), tmdbId: 10, title: 'Owner show' }),
    );
    const body = { seriesId: ownerSeries.id, release: RELEASE, today: '2026-10-22' };
    expect((await call('POST', '/api/connector/users/2/seasons', secret, body)).statusCode).toBe(
      404,
    );
    expect(await scope.run(1, () => repositories.seasons.listBySeries(ownerSeries.id))).toEqual([]);
    const bad = await call('POST', '/api/connector/users/2/seasons', secret, { seriesId: 1 });
    expect(bad.statusCode).toBe(400);
  });
});

describe('POST /api/connector/users/{id}/release-alerts', () => {
  const alert: RecordAlertsRequest['alerts'][number] = {
    subjectType: 'season',
    subjectId: 7,
    kind: 'releases_tomorrow',
    title: 'Lupin, season 2',
    message: 'Tomorrow',
    sentAt: '2026-10-22T09:00:00.000Z',
  };

  it('records delivered alerts once per key', async () => {
    const { createToken, call, scope, repositories } = await harnessWithTopics();
    const { secret } = await createToken(1, 'connector');
    const first = await call('POST', '/api/connector/users/2/release-alerts', secret, {
      alerts: [alert],
    });
    expect(first.json<RecordAlertsResponse>()).toEqual({ recorded: 1 });
    const again = await call('POST', '/api/connector/users/2/release-alerts', secret, {
      alerts: [alert, { ...alert, kind: 'releases_today' }],
    });
    expect(again.json<RecordAlertsResponse>()).toEqual({ recorded: 1 });
    expect(await scope.run(2, () => repositories.releaseAlerts.allKeys())).toHaveLength(2);
    expect(await scope.run(3, () => repositories.releaseAlerts.allKeys())).toEqual([]);
  });

  it('refuses an unknown kind', async () => {
    const { createToken, call } = await harnessWithTopics();
    const { secret } = await createToken(1, 'connector');
    const response = await call('POST', '/api/connector/users/2/release-alerts', secret, {
      alerts: [{ ...alert, kind: 'nope' }],
    });
    expect(response.statusCode).toBe(400);
  });
});
