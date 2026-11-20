import type { SteamApplyOutcome } from '@metrack/domain';

/** What an import wrote, and the games it could not. */
export interface SteamApplyTally {
  updated: number;
  imported: number;
  skipped: number;
  failed: SteamApplyOutcome[];
}
