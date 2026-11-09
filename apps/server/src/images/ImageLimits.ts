import type { ImageEncodingSite } from '@metrack/domain';
import type { ImageEncoding } from './ImageEncoding.js';

/** Image limits from the environment. */
export interface ImageLimits extends ImageEncoding {
  quotaBytes: number;
  maxUploadBytes: number;
  /** `client` when the browser recodes to WebP and the server only validates; `server` re-encodes with sharp. */
  encodedBy: ImageEncodingSite;
}
