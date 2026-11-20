import type { AccountDeletionService } from '../account/AccountDeletionService.js';
import type { MovieRuntimeBackfill } from '../backfill/MovieRuntimeBackfill.js';
import type { Logger } from '../notify/Logger.js';

export interface ScheduledTickDeps {
  accounts: AccountDeletionService;
  runtimes?: MovieRuntimeBackfill;
  logger: Logger;
}
