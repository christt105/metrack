/**
 * A pass over a season that the user left to start again from the first episode. `startedAt` and `finishedAt` are
 * the first and the last viewing of the pass, and `restartedOn` the day the new pass began; the viewings made on or
 * after it belong to the new pass. Dates are ISO `YYYY-MM-DD`.
 */
export interface AbandonedPass {
  startedAt: string | null;
  finishedAt: string | null;
  restartedOn: string;
}
