import type { Viewing } from '../Viewing.js';

/** Replaces the viewings of one episode, which becomes watched even with an empty list. */
export interface SetEpisodeViewingsOperation {
  op: 'setViewings';
  key: string;
  viewings: Viewing[];
}
