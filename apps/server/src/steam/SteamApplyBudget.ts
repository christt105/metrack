/**
 * Subrequests the Workers free plan allows one invocation (fetches, D1 statements and batches, R2 operations), and what
 * each step of an apply request costs, as measured by `steamWorkerBudget.test.ts`.
 */
export const STEAM_APPLY_BUDGET = {
  limit: 50,
  /** Sign-in, settings, Steam, IGDB sign-in and match, the library and catalog reads, and the content version bump. */
  overhead: 10,
  /** Raising the time of a game already in the library. */
  update: 3,
  /** Adding a game the shared catalog already has. */
  catalog: 3,
  /** Adding a game from IGDB: its metadata, two Steam images, SteamGridDB, and the rows and files that store them. */
  igdb: 18,
} as const;
