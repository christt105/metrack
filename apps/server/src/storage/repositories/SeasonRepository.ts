import type { Season } from '@metrack/domain';
import type { MediaEntityRepository } from './MediaEntityRepository.js';

export interface SeasonRepository extends MediaEntityRepository<Season> {
  /** Seasons of one series ordered by number. */
  listBySeries(seriesId: number): Promise<Season[]>;
}
