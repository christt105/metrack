import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH } from './HANDLE_LENGTH.js';
import { RESERVED_HANDLES } from './RESERVED_HANDLES.js';

const HANDLE_PATTERN = /^[a-z0-9-]+$/;

/** Why a normalized handle cannot be used, or null when it can. */
export function handleProblem(handle: string): string | null {
  if (handle.length < HANDLE_MIN_LENGTH || handle.length > HANDLE_MAX_LENGTH) {
    return `${HANDLE_MIN_LENGTH} to ${HANDLE_MAX_LENGTH} characters`;
  }
  if (!HANDLE_PATTERN.test(handle)) return 'lowercase letters, digits and "-"';
  if (RESERVED_HANDLES.has(handle)) return 'that word is reserved';
  return null;
}
