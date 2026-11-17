/**
 * One viewing of an item after its first. Dates are ISO `YYYY-MM-DD`. A viewing with `finishedAt` null is
 * in progress; the first viewing lives in the `startedAt` and `finishedAt` of the item itself.
 */
export interface Viewing {
  startedAt: string | null;
  finishedAt: string | null;
}
