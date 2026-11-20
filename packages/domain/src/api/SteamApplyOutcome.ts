/**
 * What happened to one Steam game: written, left as it was because there was nothing to do, failed, or not reached
 * because the request ran out of its subrequest budget, in which case the same id is sent again.
 */
export interface SteamApplyOutcome {
  appId: string;
  result: 'updated' | 'imported' | 'skipped' | 'failed' | 'deferred';
  error?: string;
}
