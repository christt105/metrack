/** A season entry whose start date is after its finish date; only seasons without a catalog can hold one for good. */
export interface SeasonDateConflict {
  seasonId: number;
  startedAt: string;
  finishedAt: string;
}
