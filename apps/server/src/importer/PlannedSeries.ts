import type { Series } from '@metrack/domain';
import type { PlannedEntity } from './PlannedEntity.js';
import type { PlannedSeason } from './PlannedSeason.js';

export interface PlannedSeries extends PlannedEntity<Omit<Series, 'id'>> {
  seasons: PlannedSeason[];
  /** True when the series has no season notes and the single season comes from the series note. */
  implicitSeason: boolean;
}
