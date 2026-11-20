/**
 * Subrequests that preparing the artwork of one game costs, as measured by `steamWorkerBudget.test.ts`: `linked` when
 * both images come from the linked source, `fallback` when a Steam image was missing and IGDB had to be asked.
 */
export const GAME_ARTWORK_COST = {
  linked: 14,
  fallback: 20,
} as const;
