import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applySeasonOverrides,
  matchSeasonsByAirDate,
  transitionStatus,
  type Movie,
  type Season,
  type SeasonSource,
  type Series,
  type Tracking,
} from '@metrack/domain';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import {
  BookRepository,
  MovieRepository,
  SeasonOverrideRepository,
  SeasonRepository,
  SeriesRepository,
  UnlinkedTitleRepository,
  VideogameRepository,
} from '../src/storage/repositories/index.js';

const tracking: Tracking = {
  status: 'planned',
  startedAt: null,
  finishedAt: null,
  rating: null,
  review: null,
  rewatches: [],
};

const newSeries = (over: Partial<Omit<Series, 'id'>> = {}): Omit<Series, 'id'> => ({
  tmdbId: null,
  tvdbId: null,
  jellyfinId: null,
  title: 'Series',
  originalTitle: null,
  firstAirDate: null,
  overview: null,
  genres: [],
  cast: [],
  follow: false,
  note: null,
  cover: null,
  banner: null,
  slug: null,
  tags: [],
  ...over,
});

const newSeason = (
  seriesId: number,
  number: number,
  over: Partial<Omit<Season, 'id'>> = {},
): Omit<Season, 'id'> => ({
  seriesId,
  number,
  tmdbSeasonNumber: null,
  jellyfinId: null,
  title: null,
  overview: null,
  firstAirDate: null,
  episodeCount: null,
  cover: null,
  banner: null,
  slug: null,
  tags: [],
  ...tracking,
  ...over,
});

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  new MigrationRunner(db, migrations).run();
});

describe('MovieRepository', () => {
  const movie: Omit<Movie, 'id'> = {
    tmdbId: 965150,
    jellyfinId: null,
    title: 'Aftersun',
    originalTitle: 'Aftersun',
    releaseDate: '2022-10-21',
    overview: 'Vacations.',
    genres: ['Drama'],
    cast: ['Paul Mescal'],
    director: 'Charlotte Wells',
    note: null,
    cover: 'cover.jpg',
    banner: null,
    slug: 'Aftersun (2022)',
    tags: ['drama'],
    ...tracking,
    status: 'completed',
    startedAt: '2026-03-15',
    finishedAt: '2026-03-15',
    rating: 6,
    review: 'Tough.',
    rewatches: ['2026-08-01'],
  };

  it('round-trips every field', () => {
    const repo = new MovieRepository(db);
    const created = repo.create(movie);
    expect(created).toEqual({ id: created.id, ...movie });
    expect(repo.get(created.id)).toEqual(created);
  });

  it('updates with a patch, lists and deletes', () => {
    const repo = new MovieRepository(db);
    const created = repo.create(movie);
    const updated = repo.update(created.id, { rating: 8, genres: ['Drama', 'Indie'] });
    expect(updated).toMatchObject({ rating: 8, genres: ['Drama', 'Indie'], title: 'Aftersun' });
    expect(repo.list()).toHaveLength(1);
    expect(repo.delete(created.id)).toBe(true);
    expect(repo.get(created.id)).toBeUndefined();
    expect(repo.delete(created.id)).toBe(false);
  });

  it('rejects a duplicate tmdb_id and an out of range rating', () => {
    const repo = new MovieRepository(db);
    repo.create(movie);
    expect(() => repo.create(movie)).toThrow();
    expect(() => repo.create({ ...movie, tmdbId: 1, rating: 11 })).toThrow();
  });

  it('reserves cache columns with defaults', () => {
    const repo = new MovieRepository(db);
    const { id } = repo.create(movie);
    const row = db
      .prepare('SELECT fetched_at, metadata_hash, edited_fields FROM movie WHERE id = ?')
      .get(id);
    expect(row).toEqual({ fetched_at: null, metadata_hash: null, edited_fields: '[]' });
  });
});

describe('videogames and books', () => {
  it('round-trips a videogame with its own ids', () => {
    const repo = new VideogameRepository(db);
    const created = repo.create({
      igdbId: 27719,
      steamAppId: '447150',
      steamGridDbId: 10875,
      title: 'Ape Out',
      releaseDate: '2019-02-28',
      overview: null,
      genres: ['Arcade'],
      developer: 'Gabe Cuzzillo',
      platforms: ['PC'],
      note: null,
      cover: null,
      banner: null,
      slug: null,
      tags: ['rpg'],
      ...tracking,
    });
    expect(repo.get(created.id)).toEqual(created);
    expect(created.steamAppId).toBe('447150');
  });

  it('round-trips a book', () => {
    const repo = new BookRepository(db);
    const created = repo.create({
      openLibraryId: 'OL1M',
      isbn: '9780000000002',
      title: 'Book',
      authors: ['A', 'B'],
      publisher: 'Pub',
      pageCount: 300,
      releaseDate: null,
      overview: null,
      genres: [],
      note: null,
      cover: null,
      slug: null,
      tags: [],
      ...tracking,
    });
    expect(repo.get(created.id)).toEqual(created);
  });
});

describe('series and seasons', () => {
  it('stores the follow flag and filters followed series', () => {
    const repo = new SeriesRepository(db);
    const a = repo.create(newSeries({ title: 'A', tmdbId: 1 }));
    repo.create(newSeries({ title: 'B', tmdbId: 2 }));
    expect(repo.listFollowed()).toEqual([]);
    repo.update(a.id, { follow: true });
    expect(repo.listFollowed().map((s) => s.title)).toEqual(['A']);
  });

  it('cascades season deletion with the series and keeps numbers unique per series', () => {
    const series = new SeriesRepository(db);
    const seasons = new SeasonRepository(db);
    const s = series.create(newSeries());
    seasons.create(newSeason(s.id, 1));
    expect(() => seasons.create(newSeason(s.id, 1))).toThrow();
    series.delete(s.id);
    expect(seasons.list()).toEqual([]);
  });

  it('tracks started_at and finished_at per season', () => {
    const series = new SeriesRepository(db);
    const seasons = new SeasonRepository(db);
    const s = series.create(newSeries());
    const one = seasons.create(newSeason(s.id, 1));
    const two = seasons.create(newSeason(s.id, 2));
    const done = transitionStatus(
      transitionStatus(one, 'in_progress', '2026-01-01'),
      'completed',
      '2026-01-20',
    );
    seasons.update(one.id, done);
    expect(seasons.get(one.id)).toMatchObject({
      startedAt: '2026-01-01',
      finishedAt: '2026-01-20',
    });
    expect(seasons.get(two.id)).toMatchObject({ startedAt: null, finishedAt: null });
  });

  it('a one season series is a series with one season', () => {
    const series = new SeriesRepository(db);
    const seasons = new SeasonRepository(db);
    const s = series.create(newSeries({ title: 'Abandonados', tmdbId: 324050 }));
    seasons.create(newSeason(s.id, 1, { episodeCount: 4 }));
    expect(seasons.listBySeries(s.id)).toHaveLength(1);
  });
});

describe('Lupin: season 3 in TMDB is season 4 in Jellyfin', () => {
  it('links the stored season through season_override and date matching', () => {
    const series = new SeriesRepository(db);
    const seasons = new SeasonRepository(db);
    const overrides = new SeasonOverrideRepository(db);
    const lupin = series.create(newSeries({ title: 'Lupin', tmdbId: 1, tvdbId: 375921 }));
    seasons.create(
      newSeason(lupin.id, 3, { tmdbSeasonNumber: 3, firstAirDate: '2026-10-23', episodeCount: 8 }),
    );

    overrides.set({
      seriesId: lupin.id,
      tmdbSeasonNumber: 3,
      number: 4,
      title: null,
      jellyfinSeasonId: 'jf-s4',
    });
    overrides.set({
      seriesId: lupin.id,
      tmdbSeasonNumber: 3,
      number: 4,
      title: 'Part 3',
      jellyfinSeasonId: 'jf-s4',
    });
    expect(overrides.listBySeries(lupin.id)).toEqual([
      {
        seriesId: lupin.id,
        tmdbSeasonNumber: 3,
        number: 4,
        title: 'Part 3',
        jellyfinSeasonId: 'jf-s4',
      },
    ]);

    const tmdb: SeasonSource[] = seasons.listBySeries(lupin.id).map((s) => ({
      number: s.tmdbSeasonNumber ?? s.number,
      firstAirDate: s.firstAirDate ?? '',
      episodeCount: s.episodeCount ?? 0,
    }));
    const jellyfin: SeasonSource[] = [{ number: 4, firstAirDate: '2026-10-23', episodeCount: 3 }];
    expect(matchSeasonsByAirDate(jellyfin, tmdb).matched).toHaveLength(1);
    expect(applySeasonOverrides(tmdb, overrides.listBySeries(lupin.id))[0]).toMatchObject({
      number: 4,
      title: 'Part 3',
    });

    expect(overrides.delete(lupin.id, 3)).toBe(true);
    expect(overrides.listBySeries(lupin.id)).toEqual([]);
  });
});

describe('Dan Da Dan: TMDB one season of 24, Jellyfin two of 12', () => {
  it('stores the Jellyfin structure with the TMDB season number on the first one', () => {
    const series = new SeriesRepository(db);
    const seasons = new SeasonRepository(db);
    const s = series.create(newSeries({ title: 'Dan Da Dan', tmdbId: 240411, tvdbId: 1 }));
    seasons.create(
      newSeason(s.id, 1, { tmdbSeasonNumber: 1, firstAirDate: '2024-10-04', episodeCount: 12 }),
    );
    seasons.create(newSeason(s.id, 2, { firstAirDate: '2025-07-03', episodeCount: 12 }));
    expect(seasons.listBySeries(s.id).map((x) => [x.number, x.tmdbSeasonNumber])).toEqual([
      [1, 1],
      [2, null],
    ]);
  });
});

describe('UnlinkedTitleRepository', () => {
  it('collects titles without ids and removes them once resolved', () => {
    const repo = new UnlinkedTitleRepository(db);
    const t = repo.create({
      mediaType: 'series',
      title: 'Mystery Show',
      year: 2020,
      source: 'jellyfin',
      sourceRef: '/media/Series/Mystery Show',
      createdAt: '2026-10-24T10:00:00.000Z',
    });
    expect(repo.list()).toEqual([t]);
    expect(repo.delete(t.id)).toBe(true);
    expect(repo.list()).toEqual([]);
  });

  it('rejects an unknown media type', () => {
    const repo = new UnlinkedTitleRepository(db);
    expect(() =>
      repo.create({
        mediaType: 'podcast' as never,
        title: 'x',
        year: null,
        source: 's',
        sourceRef: null,
        createdAt: 'now',
      }),
    ).toThrow();
  });
});
