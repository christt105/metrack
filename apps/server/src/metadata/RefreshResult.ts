/**
 * `fresh`: not stale, nothing requested. `unchanged`: provider returned the same content, only
 * `fetched_at` moved. `updated`: stored data changed. `failed`: provider error, stored data kept.
 */
export type RefreshResult =
  | { outcome: 'fresh' }
  | { outcome: 'unchanged' }
  | { outcome: 'updated'; fields: string[] }
  | { outcome: 'failed'; error: string };
