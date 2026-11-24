/**
 * A pass over a season that the user left to start again: the abandoned viewings of its episodes made up on one day.
 * `startedAt` and `finishedAt` are the earliest start and the latest finish among them, `abandonedOn` the day the
 * season was started over, `watched` how many episodes have one and `total` how many are owed. Dates are ISO `YYYY-MM-DD`.
 */
export interface AbandonedPass {
  startedAt: string | null;
  finishedAt: string | null;
  abandonedOn: string;
  watched: number;
  total: number;
}
