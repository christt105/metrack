import type { EpisodeOperation } from './api/EpisodeOperation.js';
import { applyEpisodeOperation } from './applyEpisodeOperation.js';
import type { EpisodeState } from './EpisodeState.js';

/**
 * Applies one operation to what the user recorded and returns the result; the input is not changed. Watching an
 * episode (`mark`, `setViewings`) takes it out of the skipped ones. Skipping removes an undated watch (the abandoned viewings stay) and leaves
 * dated ones alone, which the caller refuses first (see `skipBlockers`); unskipping only forgets the skip.
 */
export function applyEpisodeChange(state: EpisodeState, operation: EpisodeOperation): EpisodeState {
  switch (operation.op) {
    case 'skip': {
      const watches = { ...state.watches };
      for (const key of operation.keys) {
        const abandoned = (watches[key] ?? []).filter(
          (viewing) => viewing.abandonedAt !== undefined,
        );
        if (abandoned.length === 0) delete watches[key];
        else watches[key] = abandoned;
      }
      return { watches, skipped: [...new Set([...state.skipped, ...operation.keys])] };
    }
    case 'unskip': {
      const drop = new Set(operation.keys);
      return { watches: state.watches, skipped: state.skipped.filter((key) => !drop.has(key)) };
    }
    case 'mark':
    case 'setViewings': {
      const touched = new Set(operation.op === 'mark' ? operation.keys : [operation.key]);
      return {
        watches: applyEpisodeOperation(state.watches, operation),
        skipped: state.skipped.filter((key) => !touched.has(key)),
      };
    }
    case 'unmark':
      return { watches: applyEpisodeOperation(state.watches, operation), skipped: state.skipped };
  }
}
