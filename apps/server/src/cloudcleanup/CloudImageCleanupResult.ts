export interface CloudImageCleanupResult {
  /** Whether images were deleted; false for a dry run. */
  applied: boolean;
  /** Images stored in the cloud. */
  total: number;
  /** Orphans older than the grace period. */
  orphans: number;
  /** Their size on disk, from the image rows. */
  orphanBytes: number;
  /** Orphans whose row was deleted. */
  removed: number;
  /** Orphans whose row was deleted but whose object could not be, or that failed before that. */
  failed: number;
  durationMs: number;
}
