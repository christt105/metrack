import { DATE_PATTERN, nullableDate } from './fieldTypes.js';

const episodeNumber = { type: 'integer', minimum: 1, maximum: 100000 } as const;
const numbers = { type: 'array', items: episodeNumber } as const;

const episodeViewing = {
  type: 'object',
  properties: {
    startedAt: nullableDate,
    finishedAt: { type: 'string', pattern: DATE_PATTERN },
  },
  required: ['startedAt', 'finishedAt'],
  additionalProperties: false,
} as const;

/** One operation on the watched episodes of a season: `mark`, `unmark` or `setViewings`. */
export const episodeOperationBody = {
  anyOf: [
    {
      type: 'object',
      properties: { op: { const: 'mark' }, numbers, date: nullableDate },
      required: ['op', 'numbers', 'date'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { op: { const: 'unmark' }, numbers },
      required: ['op', 'numbers'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        op: { const: 'setViewings' },
        number: episodeNumber,
        viewings: { type: 'array', items: episodeViewing },
      },
      required: ['op', 'number', 'viewings'],
      additionalProperties: false,
    },
  ],
} as const;
