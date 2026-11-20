import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH } from './HANDLE_LENGTH.js';
import type { HandleProblemRule } from './HandleProblemRule.js';
import { handleProblemKind } from './handleProblemKind.js';

const DESCRIPTIONS: Record<HandleProblemRule, string> = {
  length: `${HANDLE_MIN_LENGTH} to ${HANDLE_MAX_LENGTH} characters`,
  characters: 'lowercase letters, digits and "-"',
  reserved: 'that word is reserved',
};

/** Why a normalized handle cannot be used, or null when it can. */
export function handleProblem(handle: string): string | null {
  const kind = handleProblemKind(handle);
  return kind === null ? null : DESCRIPTIONS[kind];
}
