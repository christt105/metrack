/**
 * Body of `POST /api/{collection}/{id}/rewatches`. Send either `date` (the finish of a viewing without a start) or
 * `finishedAt` with an optional `startedAt`. Dates are ISO `YYYY-MM-DD`.
 */
export interface RewatchRequest {
  date?: string;
  startedAt?: string | null;
  finishedAt?: string;
}
