import type { AccountDeletionService } from '../account/AccountDeletionService.js';
import type { EditServices } from '../api/EditServices.js';
import type { Config } from '../config/Config.js';
import type { ImageStore } from '../images/ImageStore.js';
import type { MetadataCache } from '../metadata/MetadataCache.js';
import type { Logger } from '../notify/Logger.js';
import type { Repositories } from '../storage/repositories/Repositories.js';
import type { UserScope } from '../users/UserScope.js';
import type { ScheduledTick } from './ScheduledTick.js';

/** What the Worker's `fetch` and `scheduled` handlers are built from, created once per isolate. */
export interface WorkerServices {
  config: Config;
  logger: Logger;
  scope: UserScope;
  repositories: Repositories;
  imageStore: ImageStore;
  metadataCache: MetadataCache;
  edit: EditServices;
  accountDeletion: AccountDeletionService;
  scheduled: ScheduledTick;
}
