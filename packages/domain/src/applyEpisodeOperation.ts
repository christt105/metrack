import type { EpisodeOperation } from './api/EpisodeOperation.js';
import type { EpisodeWatches } from './EpisodeWatches.js';
import { mergeEpisodeWatches } from './mergeEpisodeWatches.js';
import { normalizeViewings } from './normalizeViewings.js';

/**
 * Applies one operation to the watches and returns the result; the input is not changed. Numbers are not checked
 * against the season, and viewings are taken as given (see `normalizeViewings`).
 */
export function applyEpisodeOperation(
  watches: EpisodeWatches,
  operation: EpisodeOperation,
): EpisodeWatches {
  switch (operation.op) {
    case 'mark': {
      const viewings =
        operation.date === null ? [] : [{ startedAt: null, finishedAt: operation.date }];
      const incoming: EpisodeWatches = {};
      for (const number of operation.numbers) incoming[String(number)] = viewings;
      return mergeEpisodeWatches(watches, incoming);
    }
    case 'unmark': {
      const next = { ...watches };
      for (const number of operation.numbers) delete next[String(number)];
      return next;
    }
    case 'setViewings':
      return { ...watches, [String(operation.number)]: normalizeViewings(operation.viewings) };
  }
}
