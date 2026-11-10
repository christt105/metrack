import type { ImageEncodingSite } from '@metrack/domain';
import type { ImageEncoder } from './ImageEncoder.js';
import type { UrlGuard } from './UrlGuard.js';

export interface ImageStoreOptions {
  encoder?: ImageEncoder;
  /** Checks URLs of any site before a user's copy is fetched. */
  urlGuard?: UrlGuard;
  /** How many bytes of their own images each user may keep. */
  quotaBytes?: number;
  /** Largest file a user may upload or copy, before re-encoding. */
  maxUploadBytes?: number;
  /** Who encodes uploads, reported to the web; `server` by default. */
  encodedBy?: ImageEncodingSite;
  /** Longest side, in pixels, a stored image may have; reported to the web so it recodes to the same size. */
  maxDimension?: number;
}
