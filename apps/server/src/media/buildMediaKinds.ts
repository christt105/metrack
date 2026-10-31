import type {
  Book,
  Collection,
  MediaSummary,
  Movie,
  Season,
  Series,
  Tracking,
  Videogame,
} from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import { asMediaRepository } from './asMediaRepository.js';
import {
  emptyBook,
  emptyMovie,
  emptySeason,
  emptySeries,
  emptyVideogame,
} from './emptyEntities.js';
import type { MediaKind } from './MediaKind.js';
import type { MediaKindSources } from './MediaKindSources.js';

function summary(partial: Pick<MediaSummary, 'type' | 'id' | 'title'>): MediaSummary {
  return {
    subtitle: null,
    releaseDate: null,
    cover: null,
    status: null,
    rating: null,
    startedAt: null,
    finishedAt: null,
    seriesId: null,
    seriesTitle: null,
    seasonCount: null,
    pendingReview: false,
    ...partial,
  };
}

function trackingOf(
  t: Tracking,
): Pick<MediaSummary, 'status' | 'rating' | 'startedAt' | 'finishedAt' | 'pendingReview'> {
  return {
    status: t.status,
    rating: t.rating,
    startedAt: t.startedAt,
    finishedAt: t.finishedAt,
    pendingReview: t.pendingReview,
  };
}

/** The five entity collections, wired to their repositories. */
export function buildMediaKinds(sources: MediaKindSources): Record<Collection, MediaKind> {
  const seriesTitleOf = (seriesId: number): string | null =>
    sources.series.get(seriesId)?.title ?? null;

  return {
    movies: {
      collection: 'movies',
      type: 'movie',
      repository: asMediaRepository(sources.movies),
      trackable: true,
      metadataFields: [
        'title',
        'originalTitle',
        'releaseDate',
        'overview',
        'genres',
        'cast',
        'director',
      ],
      imageKinds: ['cover', 'banner'],
      defaults: () => ({ ...emptyMovie() }),
      summarize: (entity) => {
        const m = entity as Movie;
        return {
          ...summary({ type: 'movie', id: m.id, title: m.title }),
          subtitle: m.originalTitle !== m.title ? m.originalTitle : null,
          releaseDate: m.releaseDate,
          cover: m.cover,
          ...trackingOf(m),
        };
      },
    },
    series: {
      collection: 'series',
      type: 'series',
      repository: asMediaRepository(sources.series),
      trackable: false,
      metadataFields: ['title', 'originalTitle', 'firstAirDate', 'overview', 'genres', 'cast'],
      imageKinds: ['cover', 'banner'],
      defaults: () => ({ ...emptySeries() }),
      summarize: (entity) => {
        const s = entity as Series;
        const seasons = sources.seasons.listBySeries(s.id);
        return {
          ...summary({ type: 'series', id: s.id, title: s.title }),
          subtitle: s.originalTitle !== s.title ? s.originalTitle : null,
          releaseDate: s.firstAirDate,
          cover: s.cover,
          seasonCount: seasons.length,
          pendingReview: seasons.some((season) => season.pendingReview),
        };
      },
      extend: (entity) => ({
        seasons: sources.seasons.listBySeries(entity.id),
        overrides: sources.overrides.listBySeries(entity.id),
      }),
    },
    seasons: {
      collection: 'seasons',
      type: 'season',
      repository: asMediaRepository(sources.seasons),
      trackable: true,
      metadataFields: ['title', 'overview', 'firstAirDate', 'episodeCount'],
      imageKinds: ['cover', 'banner'],
      defaults: () => ({ ...emptySeason() }),
      checkReferences: (values) => {
        if (!sources.series.get(Number(values.seriesId))) {
          throw ApiError.badRequest(
            'invalid_reference',
            `Series ${String(values.seriesId)} does not exist`,
          );
        }
      },
      summarize: (entity) => {
        const s = entity as Season;
        const parent = sources.series.get(s.seriesId);
        return {
          ...summary({ type: 'season', id: s.id, title: s.title ?? `Season ${s.number}` }),
          subtitle: parent?.title ?? null,
          releaseDate: s.firstAirDate,
          cover: s.cover ?? parent?.cover ?? null,
          seriesId: s.seriesId,
          seriesTitle: seriesTitleOf(s.seriesId),
          ...trackingOf(s),
        };
      },
    },
    games: {
      collection: 'games',
      type: 'videogame',
      repository: asMediaRepository(sources.videogames),
      trackable: true,
      metadataFields: ['title', 'releaseDate', 'overview', 'genres', 'developer', 'platforms'],
      imageKinds: ['cover', 'banner'],
      defaults: () => ({ ...emptyVideogame() }),
      summarize: (entity) => {
        const g = entity as Videogame;
        return {
          ...summary({ type: 'videogame', id: g.id, title: g.title }),
          subtitle: g.developer,
          releaseDate: g.releaseDate,
          cover: g.cover,
          ...trackingOf(g),
        };
      },
    },
    books: {
      collection: 'books',
      type: 'book',
      repository: asMediaRepository(sources.books),
      trackable: true,
      metadataFields: [
        'title',
        'authors',
        'publisher',
        'pageCount',
        'releaseDate',
        'overview',
        'genres',
      ],
      imageKinds: ['cover'],
      defaults: () => ({ ...emptyBook() }),
      summarize: (entity) => {
        const b = entity as Book;
        return {
          ...summary({ type: 'book', id: b.id, title: b.title }),
          subtitle: b.authors.join(', ') || null,
          releaseDate: b.releaseDate,
          cover: b.cover,
          ...trackingOf(b),
        };
      },
    },
  };
}
