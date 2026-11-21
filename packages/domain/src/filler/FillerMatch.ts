import type { FilledEpisode } from './FilledEpisode.js';

export type FillerMatch =
  | { ok: true; episodes: FilledEpisode[] }
  | {
      ok: false;
      code: 'filler_count_mismatch' | 'filler_list_invalid';
      ours: number;
      theirs: number;
    };
