import type { Season } from '@metrack/domain';
import type { EntityRepository } from './EntityRepository.js';

export interface SeasonRepository extends EntityRepository<Season> {
  /** Seasons of one series ordered by number. */
  listBySeries(seriesId: number): Promise<Season[]>;
}
