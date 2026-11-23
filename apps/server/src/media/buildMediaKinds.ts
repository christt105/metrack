import {
  hasAllAchievements,
  sumTimeSpent,
  type Book,
  type Collection,
  type MediaSummary,
  type Movie,
  type Season,
  type Series,
  type Tracking,
  type Videogame,
} from '@metrack/domain';
import type { SeasonEpisodesRepository } from '../storage/repositories/SeasonEpisodesRepository.js';
import { ApiError } from '../api/ApiError.js';
import { asMediaRepository } from './asMediaRepository.js';
import {
  emptyBook,
  emptyMovie,
  emptySeason,
  emptySeries,
  emptyVideogame,
} from './emptyEntities.js';
import { seasonTimeSpentOf } from './seasonTimeSpentOf.js';
import type { MediaKind } from './MediaKind.js';
import type { MediaKindSources } from './MediaKindSources.js';

function summary(partial: Pick<MediaSummary, 'type' | 'id' | 'title'>): MediaSummary {
  return {
    subtitle: null,
    releaseDate: null,
    cover: null,
    banner: null,
    status: null,
    rating: null,
    startedAt: null,
    finishedAt: null,
    seriesId: null,
    seriesTitle: null,
    seasonCount: null,
    pendingReview: false,
    watching: false,
    allAchievements: false,
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

function isWatching(t: Tracking & { wantsRewatch?: boolean }): boolean {
  return (
    t.status === 'in_progress' ||
    t.rewatches.some((viewing) => viewing.finishedAt === null) ||
    (t.wantsRewatch === true && t.status === 'completed')
  );
}

/** The five entity collections, wired to their repositories. */
export function buildMediaKinds(
  sources: MediaKindSources,
  catalogs: SeasonEpisodesRepository,
): Record<Collection, MediaKind> {
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
          banner: m.banner,
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
      summarize: (entity, context) => {
        const s = entity as Series;
        const seasons = context.seasonsOf(s.id);
        return {
          ...summary({ type: 'series', id: s.id, title: s.title }),
          subtitle: s.originalTitle !== s.title ? s.originalTitle : null,
          releaseDate: s.firstAirDate,
          cover: s.cover,
          banner: s.banner,
          seasonCount: seasons.length,
          pendingReview: seasons.some((season) => season.pendingReview),
          watching: seasons.some(isWatching),
        };
      },
      extend: async (entity) => {
        const seasons = await sources.seasons.listBySeries(entity.id);
        const entry = await sources.episodeWatches.getEntry(entity.id);
        const series = entity as Series;
        const byId = new Map(
          (await catalogs.listForSeries(entity.id)).map((catalog) => [catalog.seasonId, catalog]),
        );
        const timeSpent = sumTimeSpent(
          seasons.map((season) =>
            seasonTimeSpentOf(
              season,
              series,
              byId.get(season.id),
              entry?.watched ?? {},
              entry?.skipped ?? [],
            ),
          ),
        );
        return {
          seasons,
          unmatched: entry?.unmatched ?? [],
          timeSpentMinutes: timeSpent?.minutes ?? null,
        };
      },
    },
    seasons: {
      collection: 'seasons',
      type: 'season',
      repository: asMediaRepository(sources.seasons),
      trackable: true,
      metadataFields: ['title', 'overview', 'firstAirDate', 'episodeCount'],
      imageKinds: ['cover', 'banner'],
      defaults: () => ({ ...emptySeason() }),
      checkReferences: async (values) => {
        if (!(await sources.series.get(Number(values.seriesId)))) {
          throw ApiError.badRequest(
            'invalid_reference',
            `Series ${String(values.seriesId)} does not exist`,
          );
        }
      },
      extend: async (entity) => {
        const season = entity as Season;
        const entry = await sources.episodeWatches.getEntry(season.seriesId);
        const timeSpent = seasonTimeSpentOf(
          season,
          await sources.series.get(season.seriesId),
          await catalogs.get(season.id),
          entry?.watched ?? {},
          entry?.skipped ?? [],
        );
        return { timeSpentMinutes: timeSpent?.minutes ?? null };
      },
      summarize: (entity, context) => {
        const s = entity as Season;
        const parent = context.series.get(s.seriesId);
        return {
          ...summary({ type: 'season', id: s.id, title: s.title ?? `Season ${s.number}` }),
          subtitle: parent?.title ?? null,
          releaseDate: s.firstAirDate,
          cover: s.cover ?? parent?.cover ?? null,
          banner: s.banner ?? parent?.banner ?? null,
          seriesId: s.seriesId,
          seriesTitle: parent?.title ?? null,
          ...trackingOf(s),
          watching: isWatching(s),
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
          banner: g.banner,
          allAchievements: hasAllAchievements(g),
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
