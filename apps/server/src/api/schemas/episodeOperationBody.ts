import { DATE_PATTERN, nullableDate } from './fieldTypes.js';

const episodeKey = {
  type: 'string',
  pattern: '^([1-9][0-9]{0,11}|s[0-9]{1,4}e[1-9][0-9]{0,5})$',
} as const;
const keys = { type: 'array', items: episodeKey, maxItems: 5000 } as const;

const episodeViewing = {
  anyOf: [
    {
      type: 'object',
      properties: {
        startedAt: nullableDate,
        finishedAt: { type: 'string', pattern: DATE_PATTERN },
      },
      required: ['startedAt', 'finishedAt'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        startedAt: nullableDate,
        finishedAt: nullableDate,
        abandonedAt: { type: 'string', pattern: DATE_PATTERN },
      },
      required: ['startedAt', 'finishedAt', 'abandonedAt'],
      additionalProperties: false,
    },
  ],
} as const;

/** One operation on the watched episodes of a season: `mark`, `unmark`, `setViewings`, `restoreViewings`, `skip` or `unskip`. */
export const episodeOperationBody = {
  anyOf: [
    {
      type: 'object',
      properties: { op: { const: 'mark' }, keys, date: nullableDate },
      required: ['op', 'keys', 'date'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { op: { const: 'unmark' }, keys },
      required: ['op', 'keys'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { op: { enum: ['skip', 'unskip'] }, keys },
      required: ['op', 'keys'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        op: { const: 'restoreViewings' },
        episodes: {
          type: 'array',
          maxItems: 5000,
          items: {
            type: 'object',
            properties: { key: episodeKey, viewings: { type: 'array', items: episodeViewing } },
            required: ['key', 'viewings'],
            additionalProperties: false,
          },
        },
      },
      required: ['op', 'episodes'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        op: { const: 'setViewings' },
        key: episodeKey,
        viewings: { type: 'array', items: episodeViewing },
      },
      required: ['op', 'key', 'viewings'],
      additionalProperties: false,
    },
  ],
} as const;
