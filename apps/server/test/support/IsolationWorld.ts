/** The ids and strings user 1 owns in the isolation fixture, so a response can be searched for them. */
export interface IsolationWorld {
  readonly movieId: number;
  readonly seriesId: number;
  readonly seasonId: number;
  readonly gameId: number;
  readonly bookId: number;
  readonly unlinkedId: number;
  readonly tokenId: number;
  readonly inviteId: number;
  readonly imageHash: string;
  /** Every string that identifies user 1's data: titles, handle, token name, invite code, image hash. */
  readonly markers: readonly string[];
  /** A write token of user 2, for the routes that only accept API tokens. */
  readonly otherToken: string;
}
