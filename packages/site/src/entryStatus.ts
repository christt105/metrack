import { statusKey } from '@metrack/export';
import type { PublicEntry } from './PublicEntry.js';

const KNOWN = new Set(['finished', 'in_progress', 'paused', 'dropped', 'not_started']);

/** The status of an item as the theme knows it; anything else counts as in progress. */
export function entryStatus(entry: PublicEntry): string {
  const key = statusKey(entry.status);
  return KNOWN.has(key) ? key : 'in_progress';
}
