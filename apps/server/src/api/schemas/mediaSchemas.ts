import type { Collection } from '@metrack/domain';
import { MEDIA_PROPERTIES } from './mediaProperties.js';

export const idParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
} as const;

export function patchBody(collection: Collection): object {
  return {
    type: 'object',
    properties: MEDIA_PROPERTIES[collection],
    additionalProperties: false,
    minProperties: 1,
  };
}

/** A create body takes the same fields as a patch, plus the ones the entity cannot exist without. */
export function createBody(collection: Collection): object {
  const properties: Record<string, object> = { ...MEDIA_PROPERTIES[collection] };
  const required = ['title'];
  if (collection === 'seasons') {
    properties.seriesId = { type: 'integer', minimum: 1 };
    properties.title = { type: ['string', 'null'] };
    required.splice(0, 1, 'seriesId', 'number');
  }
  return { type: 'object', properties, required, additionalProperties: false };
}
