import type { Season } from '@metrack/domain';
import type { PlannedEntity } from './PlannedEntity.js';

export type SeasonDraft = Omit<Season, 'id' | 'seriesId'>;

export type PlannedSeason = PlannedEntity<SeasonDraft>;
