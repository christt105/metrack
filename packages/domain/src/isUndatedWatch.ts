import type { Viewing } from './Viewing.js';

/** Whether a watch only says the episode was watched, with no date on any viewing. */
export function isUndatedWatch(viewings: readonly Viewing[]): boolean {
  return viewings.every((viewing) => viewing.startedAt === null && viewing.finishedAt === null);
}
