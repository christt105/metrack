import { DATE_PATTERN, nullableDate } from './fieldTypes.js';

/** A rewatch as clients send it: a viewing object, or a plain finish date as older clients and connectors do. */
export const viewingItem = {
  anyOf: [
    { type: 'string', pattern: DATE_PATTERN },
    {
      type: 'object',
      properties: { startedAt: nullableDate, finishedAt: nullableDate },
      required: ['startedAt', 'finishedAt'],
      additionalProperties: false,
    },
  ],
} as const;
