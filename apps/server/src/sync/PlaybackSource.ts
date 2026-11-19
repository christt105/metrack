import type { PlayRecord } from '@metrack/domain';

/** Read-only history of what was played, for one account. */
export interface PlaybackSource {
  listPlays(): Promise<PlayRecord[]>;
  /** Playback of the companion accounts; undefined when none are configured, which leaves hand-marked items alone. */
  listCompanionPlays?(): Promise<PlayRecord[] | undefined>;
}
