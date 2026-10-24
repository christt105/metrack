import type { SeasonSource } from './SeasonSource.js';

export interface SeasonMatch {
  preferred: SeasonSource;
  fallback: SeasonSource;
}
