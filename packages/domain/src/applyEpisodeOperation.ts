import type { EpisodeOperation } from './api/EpisodeOperation.js';
import type { EpisodeWatches } from './EpisodeWatches.js';
import { isUndatedWatch } from './isUndatedWatch.js';
import { mergeEpisodeWatches } from './mergeEpisodeWatches.js';
import { normalizeViewings } from './normalizeViewings.js';

/**
 * Applies one operation to the watches (`skip` and `unskip` do not touch them, see `applyEpisodeChange`) and returns the result; the input is not changed. Keys are not checked
 * against the season, and viewings are taken as given (see `normalizeViewings`). Marking on a date adds a viewing
 * that starts and ends that day, and unmarking takes away the last viewing of each episode, or the episode when it
 * has one or none.
 */
export function applyEpisodeOperation(
  watches: EpisodeWatches,
  operation: EpisodeOperation,
): EpisodeWatches {
  switch (operation.op) {
    case 'mark': {
      const viewings =
        operation.date === null ? [] : [{ startedAt: operation.date, finishedAt: operation.date }];
      const incoming: EpisodeWatches = {};
      for (const key of operation.keys) incoming[key] = viewings;
      return mergeEpisodeWatches(watches, incoming);
    }
    case 'unmark': {
      const next = { ...watches };
      for (const key of operation.keys) {
        const viewings = next[key];
        if (viewings === undefined || viewings.length <= 1) {
          delete next[key];
          continue;
        }
        const rest = viewings.slice(0, -1);
        next[key] = rest.length === 1 && isUndatedWatch(rest) ? [] : rest;
      }
      return next;
    }
    case 'setViewings':
      return { ...watches, [operation.key]: normalizeViewings(operation.viewings) };
    case 'skip':
    case 'unskip':
      return watches;
  }
}
