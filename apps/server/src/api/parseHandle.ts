import { handleProblem, normalizeHandle } from '@metrack/domain';
import { ApiError } from './ApiError.js';

/** The normalized handle, or null for an empty one; throws a 400 when it cannot be used. */
export function parseHandle(raw: string): string | null {
  const wanted = normalizeHandle(raw);
  if (wanted === '') return null;
  const problem = handleProblem(wanted);
  if (problem) throw ApiError.badRequest('invalid_handle', `The handle must be ${problem}`);
  return wanted;
}
