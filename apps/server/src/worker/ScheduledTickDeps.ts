import type { AccountDeletionService } from '../account/AccountDeletionService.js';
import type { Logger } from '../notify/Logger.js';

export interface ScheduledTickDeps {
  accounts: AccountDeletionService;
  logger: Logger;
}
