/**
 * One viewing of an item after its first. Dates are ISO `YYYY-MM-DD`. A viewing with `finishedAt` null is
 * in progress; the first viewing lives in the `startedAt` and `finishedAt` of the item itself. An episode viewing
 * with `abandonedAt` belongs to a pass the user left on that day to start the season over, and never counts
 * towards the season's passes; the field is absent otherwise and is never set on a season's or movie's own viewings.
 */
export interface Viewing {
  startedAt: string | null;
  finishedAt: string | null;
  abandonedAt?: string;
}
