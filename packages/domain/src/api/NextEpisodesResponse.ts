import type { NextEpisodeRow } from './NextEpisodeRow.js';

/** The series the user has something to watch next in, the one watched most recently first. */
export interface NextEpisodesResponse {
  rows: NextEpisodeRow[];
}
