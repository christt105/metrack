import type { EntityRef, MediaStatus } from '@metrack/domain';

/** Adds a game IGDB knows to the user's library, with its metadata and artwork, and their own fields set. */
export interface SteamGameAdder {
  addWith(
    externalId: string,
    entry: { status: MediaStatus; timeSpentMinutes: number },
  ): Promise<EntityRef>;
}
