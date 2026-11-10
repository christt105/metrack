import type { ImageEncodingSite } from './ImageEncodingSite.js';

/**
 * Body of `GET /api/images/usage`: how much of their quota the signed-in user's own images take
 * (`quotaBytes` is `null` for the owner, who has none) and who encodes uploads and the longest side, in pixels, a stored image may have.
 */
export interface ImageUsage {
  usedBytes: number;
  quotaBytes: number | null;
  imageEncoding: ImageEncodingSite;
  maxDimension: number;
}
