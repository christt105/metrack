import type { PendingGameArtwork } from './PendingGameArtwork.js';

/** The artwork still to be prepared for games added with deferred artwork; not scoped to a user. */
export interface GameArtworkRepository {
  /** Marks a catalog game as waiting for its artwork to be archived. */
  markPending(id: number): Promise<void>;
  /** The games waiting for artwork, lowest id first; with `userId`, only those in that user's library. */
  listPending(limit: number, userId?: number): Promise<PendingGameArtwork[]>;
  /** How many games wait for artwork; with `userId`, only those in that user's library. */
  countPending(userId?: number): Promise<number>;
  /** Stores the final artwork and the SteamGridDB id of a game and clears its pending flag. */
  complete(
    id: number,
    artwork: { cover: string | null; banner: string | null; steamGridDbId: number | null },
  ): Promise<void>;
}
