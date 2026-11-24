import type { Viewing } from '../Viewing.js';

/** Replaces the viewings of several episodes at once, each becoming watched even with an empty list. */
export interface RestoreEpisodeViewingsOperation {
  op: 'restoreViewings';
  episodes: { key: string; viewings: Viewing[] }[];
}
