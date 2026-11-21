/**
 * Subrequests the Workers free plan allows one invocation, and what each step of an achievements request costs, as
 * measured by `steamWorkerBudget.test.ts`.
 */
export const STEAM_ACHIEVEMENTS_BUDGET = {
  limit: 50,
  /** Sign-in, settings, the library read and the content version bump. */
  overhead: 6,
  /** One game: the Steam request and the write of its entry. */
  game: 4,
} as const;
