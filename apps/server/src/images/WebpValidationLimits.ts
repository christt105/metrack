/** What the WebP validator accepts. */
export interface WebpValidationLimits {
  /** Longest side in pixels an accepted image may have. */
  maxDimension: number;
  /** Largest accepted file. */
  maxBytes: number;
}
