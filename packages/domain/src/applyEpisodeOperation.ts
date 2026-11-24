import type { EpisodeOperation } from './api/EpisodeOperation.js';
import type { EpisodeWatches } from './EpisodeWatches.js';
import { isUndatedWatch } from './isUndatedWatch.js';
import { liveViewings } from './liveViewings.js';
import { mergeEpisodeWatches } from './mergeEpisodeWatches.js';
import { normalizeViewings } from './normalizeViewings.js';

/**
 * Applies one operation to the watches (`skip` and `unskip` do not touch them, see `applyEpisodeChange`) and returns the result; the input is not changed. Keys are not checked
 * against the season, and viewings are taken as given (see `normalizeViewings`). Marking on a date adds a viewing
 * that starts and ends that day, and unmarking takes away the last viewing of each episode, or the episode when it
 * has one or none; abandoned viewings are never taken away, and an episode left with only those is not watched.
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
      return mergeEpisodeWatches(watches, incoming, undefined, false);
    }
    case 'unmark': {
      const next = { ...watches };
      for (const key of operation.keys) {
        const stored = next[key];
        if (stored === undefined) continue;
        const abandoned = stored.filter((viewing) => viewing.abandonedAt !== undefined);
        const viewings = liveViewings(stored);
        if (viewings.length <= 1) {
          if (abandoned.length === 0) delete next[key];
          else next[key] = abandoned;
          continue;
        }
        const rest = viewings.slice(0, -1);
        next[key] =
          abandoned.length === 0 && rest.length === 1 && isUndatedWatch(rest)
            ? []
            : [...abandoned, ...rest];
      }
      return next;
    }
    case 'setViewings':
      return { ...watches, [operation.key]: normalizeViewings(operation.viewings) };
    case 'restoreViewings': {
      const next = { ...watches };
      for (const { key, viewings } of operation.episodes) next[key] = normalizeViewings(viewings);
      return next;
    }
    case 'skip':
    case 'unskip':
      return watches;
  }
}
