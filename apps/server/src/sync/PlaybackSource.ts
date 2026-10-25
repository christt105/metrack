import type { PlayRecord } from '@metrack/domain';

/** Read-only history of what was played, for one account. */
export interface PlaybackSource {
  listPlays(): Promise<PlayRecord[]>;
}
