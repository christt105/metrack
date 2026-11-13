import { afterAll, beforeEach, describe, expect, it } from 'vitest';
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
import type { Repositories } from '../src/storage/repositories/Repositories.js';
import { createBackends } from './support/backends.js';
import { OWNER_SCOPE } from './support/ownerScope.js';
import type { StorageHarness } from './support/StorageHarness.js';

const tracking: Tracking = {
  status: 'planned',
  startedAt: null,
  finishedAt: null,
  rating: null,
  review: null,
  rewatches: [],
  pendingReview: false,
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
  review: null,
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

const backends = createBackends();

afterAll(async () => {
  for (const backend of backends) await backend.dispose();
});

describe.each(backends)('$name repositories', (backend) => {
  let harness: StorageHarness;
  let repos: Repositories;

  beforeEach(async () => {
    harness = await backend.open();
    repos = harness.repositories(OWNER_SCOPE);
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
      follow: false,
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

    it('round-trips every field', async () => {
      const repo = repos.movies;
      const created = await repo.create(movie);
      expect(created).toEqual({ id: created.id, ...movie });
      expect(await repo.get(created.id)).toEqual(created);
    });

    it('updates with a patch, lists and deletes', async () => {
      const repo = repos.movies;
      const created = await repo.create(movie);
      const updated = await repo.update(created.id, { rating: 8, genres: ['Drama', 'Indie'] });
      expect(updated).toMatchObject({ rating: 8, genres: ['Drama', 'Indie'], title: 'Aftersun' });
      expect(await repo.list()).toHaveLength(1);
      expect(await repo.delete(created.id)).toBe(true);
      expect(await repo.get(created.id)).toBeUndefined();
      expect(await repo.delete(created.id)).toBe(false);
    });

    it('reads many ids at once, past the bound parameter limit, leaving out unknown ones', async () => {
      const ids: number[] = [];
      for (let i = 0; i < 95; i += 1) {
        ids.push((await repos.movies.create({ ...movie, tmdbId: 1000 + i, title: `M${i}` })).id);
      }
      const found = await repos.movies.getMany([999_999, ...[...ids].reverse()]);
      expect(found.map((entry) => entry.id)).toEqual(ids);
      expect(await repos.movies.getMany([])).toEqual([]);
    }, 60_000);

    it('lists the titles with a TMDB id that were never fetched', async () => {
      const fetched = await repos.movies.create({ ...movie, tmdbId: 1 });
      const unfetched = await repos.movies.create({ ...movie, tmdbId: 2, title: 'New' });
      await repos.movies.create({ ...movie, tmdbId: null, title: 'Hand' });
      await repos.metadataStates.markFetched('movie', fetched.id, '2026-11-13T00:00:00Z');
      expect(await repos.metadataStates.unfetched('movie')).toEqual([unfetched.id]);
      expect(await repos.metadataStates.unfetched('series')).toEqual([]);
    });

    it('rejects a duplicate tmdb_id and an out of range rating', async () => {
      const repo = repos.movies;
      await repo.create(movie);
      await expect(repo.create(movie)).rejects.toThrow();
      await expect(repo.create({ ...movie, tmdbId: 1, rating: 11 })).rejects.toThrow();
    });

    it('reserves cache columns with defaults', async () => {
      const repo = repos.movies;
      const { id } = await repo.create(movie);
      const rows = await harness.query(
        'SELECT c.fetched_at, c.metadata_hash, e.overrides FROM movie c JOIN movie_entry e ON e.movie_id = c.id WHERE c.id = ?',
        id,
      );
      expect(rows.map((row) => ({ ...row }))).toEqual([
        { fetched_at: null, metadata_hash: null, overrides: '{}' },
      ]);
    });
  });

  describe('videogames and books', () => {
    it('round-trips a videogame with its own ids', async () => {
      const repo = repos.videogames;
      const created = await repo.create({
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
      expect(await repo.get(created.id)).toEqual(created);
      expect(created.steamAppId).toBe('447150');
    });

    it('round-trips a book', async () => {
      const repo = repos.books;
      const created = await repo.create({
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
      expect(await repo.get(created.id)).toEqual(created);
    });
  });

  describe('series and seasons', () => {
    it('stores the follow flag and filters followed series', async () => {
      const repo = repos.series;
      const a = await repo.create(newSeries({ title: 'A', tmdbId: 1 }));
      await repo.create(newSeries({ title: 'B', tmdbId: 2 }));
      expect(await repo.listFollowed()).toEqual([]);
      await repo.update(a.id, { follow: true });
      expect((await repo.listFollowed()).map((s) => s.title)).toEqual(['A']);
    });

    it('cascades season deletion with the series and keeps numbers unique per series', async () => {
      const series = repos.series;
      const seasons = repos.seasons;
      const s = await series.create(newSeries());
      await seasons.create(newSeason(s.id, 1));
      await expect(seasons.create(newSeason(s.id, 1))).rejects.toThrow();
      await series.delete(s.id);
      expect(await seasons.list()).toEqual([]);
    });

    it('tracks started_at and finished_at per season', async () => {
      const series = repos.series;
      const seasons = repos.seasons;
      const s = await series.create(newSeries());
      const one = await seasons.create(newSeason(s.id, 1));
      const two = await seasons.create(newSeason(s.id, 2));
      const done = transitionStatus(
        transitionStatus(one, 'in_progress', '2026-01-01'),
        'completed',
        '2026-01-20',
      );
      await seasons.update(one.id, done);
      expect(await seasons.get(one.id)).toMatchObject({
        startedAt: '2026-01-01',
        finishedAt: '2026-01-20',
      });
      expect(await seasons.get(two.id)).toMatchObject({ startedAt: null, finishedAt: null });
    });

    it('a one season series is a series with one season', async () => {
      const series = repos.series;
      const seasons = repos.seasons;
      const s = await series.create(newSeries({ title: 'Abandonados', tmdbId: 324050 }));
      await seasons.create(newSeason(s.id, 1, { episodeCount: 4 }));
      expect(await seasons.listBySeries(s.id)).toHaveLength(1);
    });
  });

  describe('Lupin: season 3 in TMDB is season 4 in Jellyfin', () => {
    it('links the stored season through season_override and date matching', async () => {
      const series = repos.series;
      const seasons = repos.seasons;
      const overrides = repos.overrides;
      const lupin = await series.create(newSeries({ title: 'Lupin', tmdbId: 1, tvdbId: 375921 }));
      await seasons.create(
        newSeason(lupin.id, 3, {
          tmdbSeasonNumber: 3,
          firstAirDate: '2026-10-23',
          episodeCount: 8,
        }),
      );

      await overrides.set({
        seriesId: lupin.id,
        tmdbSeasonNumber: 3,
        number: 4,
        title: null,
        jellyfinSeasonId: 'jf-s4',
      });
      await overrides.set({
        seriesId: lupin.id,
        tmdbSeasonNumber: 3,
        number: 4,
        title: 'Part 3',
        jellyfinSeasonId: 'jf-s4',
      });
      expect(await overrides.listBySeries(lupin.id)).toEqual([
        {
          seriesId: lupin.id,
          tmdbSeasonNumber: 3,
          number: 4,
          title: 'Part 3',
          jellyfinSeasonId: 'jf-s4',
        },
      ]);
      expect(await overrides.list()).toEqual(await overrides.listBySeries(lupin.id));

      const tmdb: SeasonSource[] = (await seasons.listBySeries(lupin.id)).map((s) => ({
        number: s.tmdbSeasonNumber ?? s.number,
        firstAirDate: s.firstAirDate ?? '',
        episodeCount: s.episodeCount ?? 0,
      }));
      const jellyfin: SeasonSource[] = [{ number: 4, firstAirDate: '2026-10-23', episodeCount: 3 }];
      expect(matchSeasonsByAirDate(jellyfin, tmdb).matched).toHaveLength(1);
      expect(applySeasonOverrides(tmdb, await overrides.listBySeries(lupin.id))[0]).toMatchObject({
        number: 4,
        title: 'Part 3',
      });

      expect(await overrides.delete(lupin.id, 3)).toBe(true);
      expect(await overrides.listBySeries(lupin.id)).toEqual([]);
    });
  });

  describe('Dan Da Dan: TMDB one season of 24, Jellyfin two of 12', () => {
    it('stores the Jellyfin structure with the TMDB season number on the first one', async () => {
      const series = repos.series;
      const seasons = repos.seasons;
      const s = await series.create(newSeries({ title: 'Dan Da Dan', tmdbId: 240411, tvdbId: 1 }));
      await seasons.create(
        newSeason(s.id, 1, { tmdbSeasonNumber: 1, firstAirDate: '2024-10-04', episodeCount: 12 }),
      );
      await seasons.create(newSeason(s.id, 2, { firstAirDate: '2025-07-03', episodeCount: 12 }));
      expect((await seasons.listBySeries(s.id)).map((x) => [x.number, x.tmdbSeasonNumber])).toEqual(
        [
          [1, 1],
          [2, null],
        ],
      );
    });
  });

  describe('UnlinkedTitleRepository', () => {
    it('collects titles without ids and removes them once resolved', async () => {
      const repo = repos.unlinked;
      const t = await repo.create({
        mediaType: 'series',
        title: 'Mystery Show',
        year: 2020,
        source: 'jellyfin',
        sourceRef: '/media/Series/Mystery Show',
        createdAt: '2026-10-24T10:00:00.000Z',
      });
      expect(await repo.list()).toEqual([t]);
      expect(await repo.delete(t.id)).toBe(true);
      expect(await repo.list()).toEqual([]);
    });

    it('rejects an unknown media type', async () => {
      const repo = repos.unlinked;
      await expect(
        repo.create({
          mediaType: 'podcast' as never,
          title: 'x',
          year: null,
          source: 's',
          sourceRef: null,
          createdAt: 'now',
        }),
      ).rejects.toThrow();
    });
  });
});
