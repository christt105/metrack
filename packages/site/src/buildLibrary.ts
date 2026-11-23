import {
  finishDates,
  hasAllAchievements,
  manualTimeSpent,
  movieTimeSpent,
  seasonTimeSpent,
  type Artwork,
  Book,
  episodeKey,
  Movie,
  Season,
  SeasonEpisodes,
  Series,
  Tracking,
  Videogame,
} from '@metrack/domain';
import type { EpisodeWatchesOfSeries } from './EpisodeWatchesOfSeries.js';
import type { Library } from './Library.js';
import type { PublicEntry } from './PublicEntry.js';
import type { SiteInput } from './SiteInput.js';
import { es } from './messages/es.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import { seasonTitle } from './seasonTitle.js';

const NOTHING: Omit<PublicEntry, 'kind' | 'id' | 'title' | 'status'> = {
  slug: null,
  startedAt: null,
  finishedAt: null,
  rating: null,
  review: null,
  rewatches: [],
  abandoned: [],
  cover: null,
  banner: null,
  releaseDate: null,
  overview: null,
  genres: [],
  tags: [],
  platforms: [],
  developer: null,
  authors: [],
  externalUrl: null,
  externalLabel: null,
  seriesId: null,
  timeSpent: null,
  achievements: null,
  allAchievements: false,
};

function tracked(tracking: Tracking, artwork: Artwork): Partial<PublicEntry> {
  return {
    status: tracking.status,
    startedAt: tracking.startedAt,
    finishedAt: tracking.finishedAt,
    rating: tracking.rating,
    review: tracking.review,
    rewatches: finishDates(tracking.rewatches),
    cover: artwork.cover,
    banner: artwork.banner,
  };
}

function movieEntry(movie: Movie): PublicEntry {
  return {
    ...NOTHING,
    ...tracked(movie, movie),
    kind: 'movie',
    id: movie.id,
    title: movie.title,
    slug: movie.slug,
    status: movie.status,
    timeSpent: movieTimeSpent(movie),
    releaseDate: movie.releaseDate,
    overview: movie.overview,
    genres: movie.genres,
    tags: movie.tags,
    externalUrl: movie.tmdbId === null ? null : `https://www.themoviedb.org/movie/${movie.tmdbId}`,
    externalLabel: movie.tmdbId === null ? null : 'TMDB',
  };
}

function seriesEntry(series: Series): PublicEntry {
  return {
    ...NOTHING,
    kind: 'series',
    id: series.id,
    title: series.title,
    slug: series.slug,
    status: 'planned',
    review: series.review,
    cover: series.cover,
    banner: series.banner,
    releaseDate: series.firstAirDate,
    overview: series.overview,
    genres: series.genres,
    tags: series.tags,
    externalUrl: series.tmdbId === null ? null : `https://www.themoviedb.org/tv/${series.tmdbId}`,
    externalLabel: series.tmdbId === null ? null : 'TMDB',
  };
}

function seasonEntry(
  season: Season,
  series: Series | undefined,
  onlySeason: boolean,
  messages: SiteMessages,
  catalog: SeasonEpisodes | undefined,
  watches: EpisodeWatchesOfSeries | undefined,
): PublicEntry {
  return {
    ...NOTHING,
    ...tracked(season, {
      cover: season.cover ?? series?.cover ?? null,
      banner: season.banner ?? series?.banner ?? null,
    }),
    kind: 'season',
    id: season.id,
    title: seasonTitle(season, series, onlySeason, messages),
    slug: season.slug,
    status: season.status,
    timeSpent: seasonTimeSpent({
      episodes:
        catalog === undefined
          ? null
          : catalog.episodes.map((episode) => ({
              key: episodeKey(episode, season.number),
              runtime: episode.runtime,
            })),
      watches: watches?.watched ?? {},
      skipped: new Set(watches?.skipped ?? []),
      seriesRuntime: series?.episodeRuntime ?? null,
      watchedCount: season.watchedCount,
      finishedAt: season.finishedAt,
    }),
    releaseDate: season.firstAirDate,
    overview: season.overview,
    genres: series?.genres ?? [],
    tags: season.tags,
    seriesId: season.seriesId,
    abandoned: season.abandoned,
  };
}

function achievementsOf(game: Videogame): PublicEntry['achievements'] {
  const { achievementsUnlocked: unlocked, achievementsTotal: total } = game;
  return unlocked !== null && total !== null && total > 0 ? { unlocked, total } : null;
}

function gameEntry(game: Videogame): PublicEntry {
  return {
    ...NOTHING,
    ...tracked(game, game),
    kind: 'videogame',
    id: game.id,
    title: game.title,
    slug: game.slug,
    status: game.status,
    timeSpent: manualTimeSpent(game),
    achievements: achievementsOf(game),
    allAchievements: hasAllAchievements(game),
    releaseDate: game.releaseDate,
    overview: game.overview,
    genres: game.genres,
    tags: game.tags,
    platforms: game.platforms,
    developer: game.developer,
    externalUrl:
      game.steamAppId === null ? null : `https://store.steampowered.com/app/${game.steamAppId}`,
    externalLabel: game.steamAppId === null ? null : 'Steam',
  };
}

function bookEntry(book: Book): PublicEntry {
  return {
    ...NOTHING,
    ...tracked(book, { cover: book.cover, banner: null }),
    kind: 'book',
    id: book.id,
    title: book.title,
    slug: book.slug,
    status: book.status,
    timeSpent: manualTimeSpent(book),
    releaseDate: book.releaseDate,
    overview: book.overview,
    genres: book.genres,
    tags: book.tags,
    authors: book.authors,
  };
}

/**
 * Picks what a public page may show: everything the Hugo export publishes except items pending
 * review, which are left out whole. A series whose seasons are all pending is left out too, so it
 * does not give away a viewing that has not been confirmed.
 */
export function buildLibrary(input: SiteInput, messages: SiteMessages = es): Library {
  const seriesById = new Map(input.series.map((series) => [series.id, series]));
  const seasonCount = new Map<number, number>();
  for (const season of input.seasons) {
    seasonCount.set(season.seriesId, (seasonCount.get(season.seriesId) ?? 0) + 1);
  }
  const catalogs = new Map(input.seasonEpisodes.map((catalog) => [catalog.seasonId, catalog]));
  const watchesBySeries = new Map(input.episodeWatches.map((entry) => [entry.seriesId, entry]));
  const seasons = input.seasons
    .filter((season) => !season.pendingReview)
    .sort((a, b) => a.number - b.number || a.id - b.id)
    .map((season) =>
      seasonEntry(
        season,
        seriesById.get(season.seriesId),
        seasonCount.get(season.seriesId) === 1,
        messages,
        catalogs.get(season.id),
        watchesBySeries.get(season.seriesId),
      ),
    );
  const shown = new Set(seasons.map((season) => season.seriesId));
  const series = input.series
    .filter((entry) => (seasonCount.get(entry.id) ?? 0) === 0 || shown.has(entry.id))
    .map(seriesEntry);
  return {
    handle: input.handle,
    messages,
    profile: input.profile,
    movies: input.movies.filter((movie) => !movie.pendingReview).map(movieEntry),
    series,
    seasons,
    videogames: input.videogames.filter((game) => !game.pendingReview).map(gameEntry),
    books: input.books.filter((book) => !book.pendingReview).map(bookEntry),
  };
}
