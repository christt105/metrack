/** A write without ids that acts on the caller's own data: what to send as user 2 and the statuses that are fine. */
export interface IsolationSelfWrite {
  readonly payload?: unknown;
  readonly contentType?: string;
  readonly statuses: readonly number[];
}
