import { ApiError } from '../api/ApiError.js';

export function parseNumericId(externalId: string): number {
  const id = Number(externalId);
  if (!Number.isInteger(id) || id < 1) {
    throw ApiError.badRequest('invalid_external_id', `Not a valid id: ${externalId}`);
  }
  return id;
}
