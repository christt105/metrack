import type { ExpiryPolicy } from './ExpiryPolicy.js';

export const defaultExpiryPolicy: ExpiryPolicy = {
  recentWindowDays: 90,
  recentTtlDays: 2,
  defaultTtlDays: 30,
  finishedTtlDays: 365,
};
