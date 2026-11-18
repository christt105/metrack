import type { EpisodeOperation } from './api/EpisodeOperation.js';
import type { EpisodeWatches } from './EpisodeWatches.js';
import { mergeEpisodeWatches } from './mergeEpisodeWatches.js';
import { normalizeViewings } from './normalizeViewings.js';

/**
 * Applies one operation to the watches (`skip` and `unskip` do not touch them, see `applyEpisodeChange`) and returns the result; the input is not changed. Keys are not checked
 * against the season, and viewings are taken as given (see `normalizeViewings`). Marking on a date adds a viewing
 * that starts and ends that day.
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
      for (const key of operation.keys) delete next[key];
      return next;
    }
    case 'setViewings':
      return { ...watches, [operation.key]: normalizeViewings(operation.viewings) };
    case 'skip':
    case 'unskip':
      return watches;
  }
}
