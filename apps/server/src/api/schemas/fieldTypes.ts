import { SLUG_PATTERN } from '@metrack/domain';

export const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';

export const nullableString = { type: ['string', 'null'] } as const;
export const nullableDate = { type: ['string', 'null'], pattern: DATE_PATTERN } as const;
export const nullableSlug = { type: ['string', 'null'], pattern: SLUG_PATTERN } as const;
export const nullableInteger = { type: ['integer', 'null'] } as const;
export const stringList = { type: 'array', items: { type: 'string' } } as const;
export const title = { type: 'string', minLength: 1 } as const;
