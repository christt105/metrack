import { MEDIA_STATUSES } from '@metrack/domain';
import { DATE_PATTERN, nullableDate, nullableInteger, nullableString } from './fieldTypes.js';

const id = { type: 'integer', minimum: 1 } as const;
const nullableId = { type: ['integer', 'null'], minimum: 1 } as const;
const text = { type: 'string', minLength: 1, maxLength: 1000 } as const;

const movie = {
  type: 'object',
  properties: {
    movieId: nullableId,
    jellyfinId: text,
    tmdbId: id,
    title: text,
    startedAt: nullableDate,
    finishedAt: nullableDate,
    rewatches: { type: 'array', items: { type: 'string', pattern: DATE_PATTERN } },
  },
  required: ['movieId', 'jellyfinId', 'tmdbId', 'title', 'startedAt', 'finishedAt', 'rewatches'],
} as const;

const season = {
  type: 'object',
  properties: {
    seasonId: nullableId,
    jellyfinSeasonId: text,
    number: { type: 'integer', minimum: 0 },
    tmdbSeasonNumber: nullableInteger,
    title: nullableString,
    firstAirDate: nullableDate,
    episodeCount: { type: 'integer', minimum: 0 },
    status: { enum: [...MEDIA_STATUSES] },
    startedAt: nullableDate,
    finishedAt: nullableDate,
    completes: { type: 'boolean' },
  },
  required: [
    'seasonId',
    'jellyfinSeasonId',
    'number',
    'tmdbSeasonNumber',
    'title',
    'firstAirDate',
    'episodeCount',
    'status',
    'startedAt',
    'finishedAt',
    'completes',
  ],
} as const;

const series = {
  type: 'object',
  properties: {
    seriesId: nullableId,
    jellyfinId: text,
    tmdbId: nullableInteger,
    tvdbId: nullableInteger,
    title: text,
    seasons: { type: 'array', items: season },
  },
  required: ['seriesId', 'jellyfinId', 'tmdbId', 'tvdbId', 'title', 'seasons'],
} as const;

const unlinked = {
  type: 'object',
  properties: {
    mediaType: { enum: ['movie', 'series'] },
    jellyfinId: text,
    title: text,
    year: nullableInteger,
  },
  required: ['mediaType', 'jellyfinId', 'title', 'year'],
} as const;

/** A plan the connector computed, and the content version it read the state at. */
export const connectorSyncBody = {
  type: 'object',
  properties: {
    contentVersion: { type: 'integer', minimum: 0 },
    plan: {
      type: 'object',
      properties: {
        movies: { type: 'array', items: movie },
        series: { type: 'array', items: series },
        unlinked: { type: 'array', items: unlinked },
      },
      required: ['movies', 'series', 'unlinked'],
    },
  },
  required: ['contentVersion', 'plan'],
} as const;
