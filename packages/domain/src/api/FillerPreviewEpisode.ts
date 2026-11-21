import type { FilledEpisode } from '../filler/FilledEpisode.js';

/** One episode of the series in the filler preview, with what the user already did with it. */
export interface FillerPreviewEpisode extends FilledEpisode {
  watched: boolean;
  skipped: boolean;
}
