import { R2Client } from '../cloudbackup/R2Client.js';
import { ImageStore } from '../images/ImageStore.js';
import type { Logger } from '../notify/Logger.js';
import { D1ImageRepository } from '../storage/d1/D1ImageRepository.js';
import { CloudImageCleanup } from './CloudImageCleanup.js';
import type { CloudImageCleanupConfig } from './CloudImageCleanupConfig.js';
import { R2ObjectImageBlobStore } from './R2ObjectImageBlobStore.js';
import { RestD1Database } from './RestD1Database.js';

const unavailable = async (): Promise<never> => {
  throw new Error('The cloud image cleanup does not add images');
};

/** Builds the cleanup the settings describe: the Worker's image store over D1's REST API and R2's S3 API. */
export function createCloudImageCleanup(
  config: CloudImageCleanupConfig,
  logger: Logger,
  fetchFn: typeof fetch = fetch,
): CloudImageCleanup {
  const store = new ImageStore(
    new D1ImageRepository(new RestD1Database(config.d1, fetchFn)),
    new R2ObjectImageBlobStore(new R2Client(config.r2, fetchFn)),
    fetchFn,
    () => new Date(),
    { encoder: { encode: unavailable }, urlGuard: { check: unavailable } },
  );
  return new CloudImageCleanup(store, config.maxFraction, config.maxCount, logger);
}
