import { viewingsFromDates, type MediaStatus, type Tracking } from '@metrack/domain';
import type { ExportSources } from '../../src/export/loadExportInput.js';
import { png } from './sampleImages.js';

function tracking(
  status: MediaStatus,
  finishedAt: string | null,
  rating: number | null,
  review: string | null = null,
  rewatches: string[] = [],
): Tracking {
  return {
    status,
    startedAt: null,
    finishedAt,
    rating,
    review,
    rewatches: viewingsFromDates(rewatches),
    pendingReview: false,
  };
}

/** Fills the library with the items whose notes `syntheticVault` already holds. */
export async function seedMirrorLibrary(sources: ExportSources): Promise<void> {
  const localCover = await sources.images.add(png(40, 60), null);
  const movie = {
    jellyfinId: null,
    originalTitle: null,
    overview: null,
    genres: [],
    cast: [],
    director: null,
    runtime: null,
    follow: false,
    note: null,
    cover: null,
    banner: null,
    tags: [],
  };
  await sources.movies.create({
    ...movie,
    tmdbId: 100,
    title: 'Alpha',
    releaseDate: '2020-05-06',
    genres: ['Drama'],
    slug: 'Alpha (2020)',
    ...tracking('completed', '2024-03-05', 7, 'Great film.', ['2025-01-02']),
  });
  await sources.movies.create({
    ...movie,
    tmdbId: 101,
    title: 'Beta',
    cover: localCover.ref,
    slug: 'Beta (2021)',
    releaseDate: null,
    ...tracking('completed', null, null),
  });
  await sources.movies.create({
    ...movie,
    tmdbId: null,
    title: 'Gamma',
    releaseDate: null,
    slug: 'Gamma (2022)',
    ...tracking('planned', null, null),
  });

  const series = {
    tmdbEpisodeGroup: null,
    jellyfinId: null,
    originalTitle: null,
    overview: null,
    genres: [],
    cast: [],
    follow: false,
    note: null,
    cover: null,
    banner: null,
    tags: [],
    review: null,
    nextEpisode: null,
    nextEpisodeCheckedAt: null,
    episodeRuntime: null,
  };
  const season = {
    jellyfinId: null,
    overview: null,
    firstAirDate: null,
    episodeCount: null,
    watchedCount: 0,
    skippedCount: 0,
    wantsRewatch: false,
    cover: null,
    banner: null,
    tags: [],
  };
  const zeta = await sources.series.create({
    ...series,
    tmdbId: 202,
    tvdbId: null,
    title: 'Zeta',
    firstAirDate: null,
    slug: 'Zeta (2018)',
  });
  await sources.seasons.create({
    ...season,
    seriesId: zeta.id,
    number: 1,
    tmdbSeasonNumber: 1,
    title: 'Zeta - Season 1',
    slug: 'Zeta - Season 1',
    ...tracking('completed', '2019-05-05', 8),
  });
  await sources.seasons.create({
    ...season,
    seriesId: zeta.id,
    number: 3,
    tmdbSeasonNumber: 3,
    title: 'Zeta - Season 3',
    slug: 'Zeta - Season 3',
    ...tracking('in_progress', null, null),
  });

  await sources.videogames.create({
    igdbId: 300,
    steamAppId: null,
    steamGridDbId: 55,
    title: 'Hollow',
    releaseDate: null,
    overview: null,
    genres: [],
    developer: 'Studio',
    timeSpentMinutes: null,
    achievementsUnlocked: null,
    achievementsTotal: null,
    achievementsLastUnlockedAt: null,
    achievementsCheckedAt: null,
    platforms: ['PC'],
    note: null,
    cover: null,
    banner: null,
    slug: 'Hollow',
    tags: [],
    ...tracking('dropped', null, null),
  });
  await sources.books.create({
    openLibraryId: 'OL1W',
    isbn: null,
    title: 'Book One',
    authors: ['Someone'],
    publisher: 'Pub',
    pageCount: 320,
    timeSpentMinutes: null,
    releaseDate: null,
    overview: null,
    genres: [],
    cover: null,
    note: null,
    slug: 'Book One',
    tags: [],
    ...tracking('completed', '2022-02-02', null),
  });
}
