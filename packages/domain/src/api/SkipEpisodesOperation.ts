/**
 * Marks the episodes skipped: they are not watched, and the season does not wait for them to be complete. An
 * episode whose only watch is on an unknown date loses that watch; one with a dated viewing is refused.
 */
export interface SkipEpisodesOperation {
  op: 'skip';
  keys: string[];
}
