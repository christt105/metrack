import { DATE_PATTERN, nullableDate, nullableInteger, nullableString } from './fieldTypes.js';

const seasonRelease = {
  type: 'object',
  properties: {
    number: { type: 'integer', minimum: 0 },
    name: nullableString,
    overview: nullableString,
    airDate: nullableDate,
    episodeCount: nullableInteger,
  },
  required: ['number', 'name', 'overview', 'airDate', 'episodeCount'],
} as const;

export const reconcileSeasonsBody = {
  type: 'object',
  properties: {
    seriesId: { type: 'integer', minimum: 1 },
    today: { type: 'string', pattern: DATE_PATTERN },
    release: {
      type: 'object',
      properties: {
        posterUrl: nullableString,
        numberOfSeasons: { type: 'integer', minimum: 0 },
        seasons: { type: 'array', maxItems: 200, items: seasonRelease },
        nextEpisode: {
          oneOf: [
            { type: 'null' },
            {
              type: 'object',
              properties: {
                seasonNumber: { type: 'integer', minimum: 0 },
                episodeNumber: { type: 'integer', minimum: 0 },
                airDate: { type: 'string', pattern: DATE_PATTERN },
              },
              required: ['seasonNumber', 'episodeNumber', 'airDate'],
            },
          ],
        },
        flatrateEs: { type: 'boolean' },
      },
      required: ['posterUrl', 'numberOfSeasons', 'seasons', 'nextEpisode', 'flatrateEs'],
    },
  },
  required: ['seriesId', 'today', 'release'],
} as const;
