/** The deletion of a whole account: asking for it, cancelling it and carrying it out. Not user-scoped. */
export interface AccountRepository {
  /** When the user asked to delete their account, or null when they have not (or cancelled). */
  deletionRequestedAt(userId: number): Promise<string | null>;
  /** Records the request unless one is already waiting, and answers the moment of the one that counts. */
  requestDeletion(userId: number, requestedAt: string): Promise<string>;
  /** Drops a waiting request; false when there was none. */
  cancelDeletion(userId: number): Promise<boolean>;
  /** Users whose request was made at or before the moment, ordered by id. */
  dueForDeletion(requestedAtOrBefore: string): Promise<number[]>;
  /**
   * Deletes the user and everything personal they hold: entries, reviews, season overrides, the unlinked
   * inbox, sent alerts, settings, sessions, tokens, image ownership and the handle. Catalog rows added by
   * hand pass to the owner (user 1), shared catalog rows that nobody else has any more are removed, and
   * nothing of anyone else is touched. Answers the hashes of the images the user owned, which may now be
   * unused. Throws for the owner.
   */
  erase(userId: number): Promise<string[]>;
}
