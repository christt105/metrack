/** Body of every error response. `code` is stable and meant for programs, `error` is for people. */
export interface ApiErrorBody {
  error: string;
  code: string;
  details?: unknown;
}
