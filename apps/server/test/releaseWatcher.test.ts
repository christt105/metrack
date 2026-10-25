import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { ReleaseWatcher } from '../src/alerts/ReleaseWatcher.js';
import { ReleaseWatchScheduler } from '../src/alerts/ReleaseWatchScheduler.js';
import type { SeriesRelease } from '../src/alerts/SeriesRelease.js';
import { emptyMovie, emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import {
  MovieRepository,
  ReleaseAlertRepository,
  SeasonOverrideRepository,
  SeasonRepository,
  SeriesRepository,
} from '../src/storage/repositories/index.js';
import { FakeReleaseSource } from './support/FakeReleaseSource.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { RecordingNotifier } from './support/RecordingNotifier.js';

const logger = { info: () => {}, error: () => {} };

function lupin(overrides: Partial<SeriesRelease> = {}): SeriesRelease {
  return {
    posterUrl: 'https://image.tmdb.org/t/p/w500/lupin.jpg',
    numberOfSeasons: 3,
    seasons: [
      { number: 1, name: 'Part 1', overview: null, airDate: '2021-01-08', episodeCount: 5 },
      { number: 2, name: 'Part 2', overview: null, airDate: '2021-06-11', episodeCount: 5 },
      { number: 3, name: 'Part 3', overview: 'New heist', airDate: '2026-10-23', episodeCount: 8 },
    ],
    nextEpisode: { seasonNumber: 3, episodeNumber: 1, airDate: '2026-10-23' },
    flatrateEs: false,
    ...overrides,
  };
}

describe('ReleaseWatcher', () => {
  let db: DatabaseSync;
  let movies: MovieRepository;
  let series: SeriesRepository;
  let seasons: SeasonRepository;
  let overrides: SeasonOverrideRepository;
  let alerts: ReleaseAlertRepository;
  let source: FakeReleaseSource;
  let notifier: RecordingNotifier;
  let clock: Date;
  let watcher: ReleaseWatcher;
  let seriesId: number;

  const at = (iso: string): void => {
    clock = new Date(iso);
  };

  beforeEach(() => {
    db = openTestDatabase();
    movies = new MovieRepository(db);
    series = new SeriesRepository(db);
    seasons = new SeasonRepository(db);
    overrides = new SeasonOverrideRepository(db);
    alerts = new ReleaseAlertRepository(db);
    source = new FakeReleaseSource();
    notifier = new RecordingNotifier();
    clock = new Date('2026-10-22T09:00:00Z');
    watcher = new ReleaseWatcher({
      movies,
      series,
      seasons,
      overrides,
      alerts,
      source,
      notifier,
      logger,
      timeZone: 'Europe/Madrid',
      notifyFromHour: 8,
      now: () => clock,
    });
    seriesId = series.create({
      ...emptySeries(),
      tmdbId: 10,
      title: 'Lupin',
      follow: true,
    }).id;
    seasons.create({
      ...emptySeason(),
      seriesId,
      number: 1,
      tmdbSeasonNumber: 1,
      firstAirDate: '2021-01-08',
    });
    seasons.create({
      ...emptySeason(),
      seriesId,
      number: 2,
      tmdbSeasonNumber: 2,
      firstAirDate: '2021-06-11',
    });
    source.seriesById.set(10, lupin());
  });

  it('creates the announced season and warns the day before', async () => {
    const summary = await watcher.tick();
    expect(summary).toMatchObject({ checked: 1, seasonsCreated: 1, alertsSent: 1 });
    const created = seasons.listBySeries(seriesId).find((s) => s.number === 3);
    expect(created).toMatchObject({
      tmdbSeasonNumber: 3,
      firstAirDate: '2026-10-23',
      episodeCount: 8,
      status: 'planned',
    });
    expect(notifier.sent).toEqual([
      {
        title: 'Lupin, season 3',
        message: 'Releases tomorrow (2026-10-23)',
        options: {
          priority: 'default',
          tags: ['calendar'],
          imageUrl: 'https://image.tmdb.org/t/p/w500/lupin.jpg',
        },
      },
    ]);
  });

  it('sends each alert once and checks near a release every 30 minutes', async () => {
    await watcher.tick();
    await watcher.tick();
    expect(source.calls).toHaveLength(1);

    at('2026-10-22T09:31:00Z');
    expect(await watcher.tick()).toMatchObject({ checked: 1, alertsSent: 0, seasonsCreated: 0 });
    expect(source.calls).toHaveLength(2);
    expect(notifier.sent).toHaveLength(1);
  });

  it('announces the day itself and then availability, never repeating', async () => {
    await watcher.tick();
    at('2026-10-23T08:30:00Z');
    await watcher.tick();
    source.seriesById.set(10, lupin({ flatrateEs: true }));
    at('2026-10-23T09:10:00Z');
    await watcher.tick();
    at('2026-10-23T09:50:00Z');
    await watcher.tick();
    expect(notifier.sent.map((n) => n.message)).toEqual([
      'Releases tomorrow (2026-10-23)',
      'Releases today (2026-10-23)',
      'Now streaming in Spain on a subscription service',
    ]);
    expect(alerts.list().map((a) => a.kind)).toEqual([
      'available_es',
      'releases_today',
      'releases_tomorrow',
    ]);
  });

  it('keeps asking every few hours after the release until the provider appears', async () => {
    at('2026-10-26T09:00:00Z');
    await watcher.tick();
    at('2026-10-26T10:00:00Z');
    await watcher.tick();
    expect(source.calls).toHaveLength(1);
    source.seriesById.set(10, lupin({ flatrateEs: true }));
    at('2026-10-26T12:30:00Z');
    expect((await watcher.tick()).alertsSent).toBe(1);
    expect(notifier.sent[0]?.message).toContain('streaming in Spain');
  });

  it('sends nothing before the quiet hour', async () => {
    at('2026-10-22T05:00:00Z');
    expect(await watcher.tick()).toMatchObject({ checked: 0 });
    expect(source.calls).toEqual([]);
  });

  it('does not duplicate a season that Jellyfin already numbered differently', async () => {
    seasons.create({
      ...emptySeason(),
      seriesId,
      number: 4,
      firstAirDate: '2026-10-23',
      jellyfinId: 'jf-s4',
    });
    const summary = await watcher.tick();
    expect(summary.seasonsCreated).toBe(0);
    expect(seasons.listBySeries(seriesId).map((s) => [s.number, s.tmdbSeasonNumber])).toEqual([
      [1, 1],
      [2, 2],
      [4, 3],
    ]);
    expect(notifier.sent[0]?.title).toBe('Lupin, season 4');
  });

  it('uses a season override for the number of the new season', async () => {
    overrides.set({
      seriesId,
      tmdbSeasonNumber: 3,
      number: 4,
      title: null,
      jellyfinSeasonId: null,
    });
    await watcher.tick();
    expect(seasons.listBySeries(seriesId).map((s) => s.number)).toEqual([1, 2, 4]);
    expect(notifier.sent[0]?.title).toBe('Lupin, season 4');
  });

  it('does not create old seasons that are missing locally', async () => {
    source.seriesById.set(
      10,
      lupin({
        numberOfSeasons: 4,
        seasons: [
          { number: 0, name: 'Specials', overview: null, airDate: '2020-01-01', episodeCount: 1 },
          { number: 1, name: null, overview: null, airDate: '2021-01-08', episodeCount: 5 },
          { number: 2, name: null, overview: null, airDate: '2021-06-11', episodeCount: 5 },
          { number: 3, name: null, overview: null, airDate: '2024-03-01', episodeCount: 8 },
          { number: 4, name: null, overview: null, airDate: null, episodeCount: null },
        ],
        nextEpisode: null,
      }),
    );
    expect((await watcher.tick()).seasonsCreated).toBe(0);
    expect(seasons.listBySeries(seriesId)).toHaveLength(2);
  });

  it('uses the next episode date when the season has no air date yet', async () => {
    source.seriesById.set(
      10,
      lupin({
        seasons: [
          { number: 1, name: null, overview: null, airDate: '2021-01-08', episodeCount: 5 },
          { number: 2, name: null, overview: null, airDate: '2021-06-11', episodeCount: 5 },
          { number: 3, name: null, overview: null, airDate: null, episodeCount: null },
        ],
      }),
    );
    expect((await watcher.tick()).seasonsCreated).toBe(1);
    expect(seasons.listBySeries(seriesId).find((s) => s.number === 3)?.firstAirDate).toBe(
      '2026-10-23',
    );
  });

  it('ignores a next episode that is not the first of its season', async () => {
    source.seriesById.set(
      10,
      lupin({
        seasons: [
          { number: 1, name: null, overview: null, airDate: '2021-01-08', episodeCount: 5 },
          { number: 2, name: null, overview: null, airDate: '2021-06-11', episodeCount: 5 },
          { number: 3, name: null, overview: null, airDate: null, episodeCount: null },
        ],
        nextEpisode: { seasonNumber: 3, episodeNumber: 2, airDate: '2026-10-23' },
      }),
    );
    expect((await watcher.tick()).seasonsCreated).toBe(0);
    expect(notifier.sent).toEqual([]);
  });

  it('skips series that are not followed or have no TMDB id', async () => {
    series.update(seriesId, { follow: false });
    series.create({ ...emptySeries(), title: 'No id', follow: true });
    expect(await watcher.tick()).toMatchObject({ checked: 0 });
  });

  it('alerts for followed movies from their Spanish release date', async () => {
    const movie = movies.create({ ...emptyMovie(), tmdbId: 5, title: 'Heat 2', follow: true });
    source.moviesById.set(5, {
      posterUrl: null,
      releaseDate: '2026-10-23',
      flatrateEs: false,
    });
    source.seriesById.clear();
    series.update(seriesId, { follow: false });
    await watcher.tick();
    expect(notifier.sent).toEqual([
      {
        title: 'Heat 2',
        message: 'Releases tomorrow (2026-10-23)',
        options: { priority: 'default', tags: ['calendar'] },
      },
    ]);
    expect(alerts.list()[0]).toMatchObject({ subjectType: 'movie', subjectId: movie.id });
  });

  it('logs a failing check, keeps going and retries in 30 minutes', async () => {
    movies.create({ ...emptyMovie(), tmdbId: 99, title: 'Unknown', follow: true });
    const summary = await watcher.tick();
    expect(summary).toMatchObject({ failures: 1, alertsSent: 1 });
    at('2026-10-22T09:20:00Z');
    expect((await watcher.tick()).checked).toBe(0);
    at('2026-10-22T09:35:00Z');
    expect((await watcher.tick()).failures).toBe(1);
  });
});

describe('ReleaseWatchScheduler', () => {
  it('runs one pass and refuses to overlap passes', async () => {
    let release: () => void = () => {};
    let passes = 0;
    const watcher = {
      tick: () =>
        new Promise<void>((resolve) => {
          passes += 1;
          release = resolve;
        }),
    } as unknown as ReleaseWatcher;
    const scheduler = new ReleaseWatchScheduler(watcher, logger);
    const first = scheduler.tick();
    expect(await scheduler.tick()).toBe(false);
    release();
    expect(await first).toBe(true);
    expect(passes).toBe(1);
  });

  it('survives a failing pass', async () => {
    const errors: string[] = [];
    const watcher = {
      tick: async () => {
        throw new Error('boom');
      },
    } as unknown as ReleaseWatcher;
    const scheduler = new ReleaseWatchScheduler(watcher, {
      info: () => {},
      error: (m) => errors.push(m),
    });
    expect(await scheduler.tick()).toBe(true);
    expect(errors[0]).toContain('boom');
    expect(await scheduler.tick()).toBe(true);
  });
});
