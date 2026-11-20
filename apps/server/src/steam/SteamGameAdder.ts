import type { EntityRef, MediaStatus } from '@metrack/domain';

/** Adds a game IGDB knows to the user's library, with its metadata, its artwork linked but not yet archived, and their own fields set. */
export interface SteamGameAdder {
  addWithDeferredArtwork(
    externalId: string,
    entry: { status: MediaStatus; timeSpentMinutes: number },
  ): Promise<EntityRef>;
}
