/** How stored images are re-encoded. */
export interface ImageEncoding {
  /** Longest side in pixels; larger images are scaled down to it. */
  maxDimension: number;
  /** WebP quality, 1 to 100. */
  quality: number;
}
