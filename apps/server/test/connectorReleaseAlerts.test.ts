import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SeriesRelease } from '../src/alerts/SeriesRelease.js';
import { CloudClient } from '../src/connector/CloudClient.js';
import {
  ConnectorReleaseAlerts,
  STATE_REFRESH_MS,
} from '../src/connector/ConnectorReleaseAlerts.js';
import { ConnectorStateStore } from '../src/connector/ConnectorStateStore.js';
import { DailyMessageCounter } from '../src/connector/DailyMessageCounter.js';
import type { ReleaseAlertsConfig } from '../src/connector/ReleaseAlertsConfig.js';
import { emptyMovie, emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import { NO_SETTINGS } from '../src/users/NO_SETTINGS.js';
import { connectorHarness } from './support/connectorHarness.js';
import { FakeReleaseSource } from './support/FakeReleaseSource.js';

const CONFIG: ReleaseAlertsConfig = {
  ntfyUrl: 'https://ntfy.test',
  notifyFromHour: 9,
  tickMs: 300_000,
  dailyLimit: 200,
};

function lupin(): SeriesRelease {
  return {
    posterUrl: 'https://image.tmdb.org/t/p/w500/lupin.jpg',
    numberOfSeasons: 2,
    seasons: [
      { number: 1, name: 'Part 1', overview: null, airDate: '2021-01-08', episodeCount: 5 },
      { number: 2, name: 'Part 2', overview: null, airDate: '2026-10-23', episodeCount: 8 },
    ],
    nextEpisode: { seasonNumber: 2, episodeNumber: 1, airDate: '2026-10-23' },
    flatrateEs: false,
  };
}

interface Published {
  topic: string;
  title: string;
  message: string;
}

async function setup(options: { dailyLimit?: number } = {}) {
  const harness = await connectorHarness();
  const { repositories, scope } = harness;
  await repositories.settings.save(2, {
    ...NO_SETTINGS,
    jellyfinUser: 'friend-jf',
    ntfyTopic: 'friend-topic',
  });
  await scope.run(2, async () => {
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
  });
  const { secret } = await harness.createToken(1, 'connector');
  const cloudRequests: string[] = [];
  const cloudFails = { recording: false };
  const cloudFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    cloudRequests.push(`${init?.method ?? 'GET'} ${new URL(url).pathname}`);
    if (cloudFails.recording && url.endsWith('/release-alerts')) {
      return new Response('down', { status: 503 });
    }
    return harness.app.request(url, init);
  }) as typeof fetch;
  const published: Published[] = [];
  const ntfy = { up: true };
  const ntfyFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    if (!ntfy.up) return new Response('no', { status: 500 });
    published.push(JSON.parse(String(init?.body)) as Published);
    return new Response('{}');
  }) as typeof fetch;
  const source = new FakeReleaseSource();
  source.seriesById.set(10, lupin());
  const errors: string[] = [];
  const logger = { info: () => {}, error: (message: string) => errors.push(message) };
  const dir = mkdtempSync(join(tmpdir(), 'connector-alerts-'));
  const clock = { now: new Date('2026-10-22T09:00:00Z') };
  const start = () => {
    const store = new ConnectorStateStore(dir);
    return new ConnectorReleaseAlerts(
      new CloudClient('http://cloud.test', secret, cloudFetch),
      source,
      { ...CONFIG, dailyLimit: options.dailyLimit ?? CONFIG.dailyLimit },
      new DailyMessageCounter(
        store,
        options.dailyLimit ?? CONFIG.dailyLimit,
        logger,
        () => clock.now,
      ),
      logger,
      ntfyFetch,
      () => clock.now,
    );
  };
  return {
    ...harness,
    cloudRequests,
    cloudFails,
    published,
    ntfy,
    source,
    errors,
    dir,
    clock,
    start,
  };
}

describe('ConnectorReleaseAlerts', () => {
  it('creates the announced season in the cloud, sends the alert to the topic and records it', async () => {
    const { start, published, repositories, scope } = await setup();
    await start().tick();
    expect(published).toEqual([
      expect.objectContaining({
        topic: 'friend-topic',
        title: 'Lupin, season 2',
        message: expect.stringContaining('tomorrow'),
      }),
    ]);
    expect(await scope.run(2, () => repositories.releaseAlerts.allKeys())).toEqual([
      expect.objectContaining({ subjectType: 'season', kind: 'releases_tomorrow' }),
    ]);
  });

  it('does not repeat an alert after a restart', async () => {
    const { start, published, source, cloudRequests } = await setup();
    await start().tick();
    source.calls = [];
    cloudRequests.length = 0;
    await start().tick();
    expect(source.calls).toEqual(['series:10']);
    expect(published).toHaveLength(1);
  });

  it('checks and sends nothing before 09:00 in Madrid, without calling the cloud', async () => {
    const { start, published, clock, cloudRequests, source } = await setup();
    clock.now = new Date('2026-10-22T06:59:00Z');
    await start().tick();
    expect(cloudRequests).toEqual([]);
    expect(source.calls).toEqual([]);
    expect(published).toEqual([]);
    clock.now = new Date('2026-10-22T07:00:00Z');
    await start().tick();
    expect(published).toHaveLength(1);
  });

  it('asks the cloud for nothing while no title is due, and again when one is', async () => {
    const { start, cloudRequests, clock, source } = await setup();
    const alerts = start();
    await alerts.tick();
    const requests = cloudRequests.length;
    const lookups = source.calls.length;
    clock.now = new Date(clock.now.getTime() + 5 * 60_000);
    await alerts.tick();
    expect(cloudRequests).toHaveLength(requests);
    expect(source.calls).toHaveLength(lookups);

    clock.now = new Date(clock.now.getTime() + 2 * 3_600_000);
    await alerts.tick();
    expect(cloudRequests.length).toBeGreaterThan(requests);
    expect(source.calls.length).toBeGreaterThan(lookups);
  });

  it('reads the users again after the refresh interval and picks up a new follow', async () => {
    const { start, clock, scope, repositories, source, published } = await setup();
    const alerts = start();
    await alerts.tick();
    source.moviesById.set(20, { posterUrl: null, releaseDate: '2026-10-23', flatrateEs: false });
    await scope.run(2, () =>
      repositories.movies.create({ ...emptyMovie(), tmdbId: 20, title: 'Dune', follow: true }),
    );
    clock.now = new Date(clock.now.getTime() + 60_000);
    await alerts.tick();
    expect(published.map((p) => p.title)).toEqual(['Lupin, season 2']);
    clock.now = new Date(clock.now.getTime() + STATE_REFRESH_MS);
    await alerts.tick();
    expect(published.map((p) => p.title)).toContain('Dune');
  });

  it('records nothing when ntfy fails, and sends it on a later check', async () => {
    const { start, ntfy, published, clock, repositories, scope } = await setup();
    ntfy.up = false;
    const alerts = start();
    await alerts.tick();
    expect(published).toEqual([]);
    expect(await scope.run(2, () => repositories.releaseAlerts.allKeys())).toEqual([]);
    ntfy.up = true;
    clock.now = new Date(clock.now.getTime() + 31 * 60_000);
    await alerts.tick();
    expect(published).toHaveLength(1);
    expect(await scope.run(2, () => repositories.releaseAlerts.allKeys())).toHaveLength(1);
  });

  it('does not resend a delivered alert whose recording failed, and records it later', async () => {
    const { start, cloudFails, published, clock, repositories, scope, errors } = await setup();
    cloudFails.recording = true;
    const alerts = start();
    await alerts.tick();
    expect(published).toHaveLength(1);
    expect(errors.join('\n')).toContain('release check failed');
    expect(await scope.run(2, () => repositories.releaseAlerts.allKeys())).toEqual([]);

    cloudFails.recording = false;
    clock.now = new Date(clock.now.getTime() + 31 * 60_000);
    await alerts.tick();
    expect(published).toHaveLength(1);
    expect(await scope.run(2, () => repositories.releaseAlerts.allKeys())).toHaveLength(1);
  });

  describe('daily limit', () => {
    it('stops at the limit, logs it, keeps the count across restarts and resets on the next UTC day', async () => {
      const { start, published, errors, clock, repositories, scope, dir, source } = await setup({
        dailyLimit: 1,
      });
      await scope.run(2, () =>
        repositories.movies.create({ ...emptyMovie(), tmdbId: 20, title: 'Dune', follow: true }),
      );
      source.moviesById.set(20, { posterUrl: null, releaseDate: '2026-10-23', flatrateEs: false });
      await start().tick();
      expect(published).toHaveLength(1);
      expect(errors.some((e) => e.includes('daily limit of 1'))).toBe(true);
      expect(new ConnectorStateStore(dir).read().alertsSent).toEqual({
        day: '2026-10-22',
        count: 1,
      });

      clock.now = new Date('2026-10-22T20:00:00Z');
      await start().tick();
      expect(published).toHaveLength(1);

      clock.now = new Date('2026-10-23T07:00:00Z');
      await start().tick();
      expect(new ConnectorStateStore(dir).read().alertsSent).toMatchObject({ day: '2026-10-23' });
    });
  });
});
