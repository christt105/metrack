import type { AccountDeletionService } from '../account/AccountDeletionService.js';
import type { GameArtworkBackfill } from '../backfill/GameArtworkBackfill.js';
import type { MovieRuntimeBackfill } from '../backfill/MovieRuntimeBackfill.js';
import type { SeasonCacheJob } from '../seasons/SeasonCacheJob.js';
import type { Logger } from '../notify/Logger.js';

export interface ScheduledTickDeps {
  accounts: AccountDeletionService;
  runtimes?: MovieRuntimeBackfill;
  artwork?: GameArtworkBackfill;
  seasonCache?: SeasonCacheJob;
  logger: Logger;
}
