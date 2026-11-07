import type { ImageEncoding } from './ImageEncoding.js';

/** Image limits from the environment. */
export interface ImageLimits extends ImageEncoding {
  quotaBytes: number;
  maxUploadBytes: number;
}
