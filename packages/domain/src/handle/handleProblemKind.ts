import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH } from './HANDLE_LENGTH.js';
import type { HandleProblemRule } from './HandleProblemRule.js';
import { RESERVED_HANDLES } from './RESERVED_HANDLES.js';

const HANDLE_PATTERN = /^[a-z0-9-]+$/;

/** The rule a normalized handle breaks, or null when it can be used. */
export function handleProblemKind(handle: string): HandleProblemRule | null {
  if (handle.length < HANDLE_MIN_LENGTH || handle.length > HANDLE_MAX_LENGTH) return 'length';
  if (!HANDLE_PATTERN.test(handle)) return 'characters';
  if (RESERVED_HANDLES.has(handle)) return 'reserved';
  return null;
}
