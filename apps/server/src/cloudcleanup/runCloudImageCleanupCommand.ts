import type { Logger } from '../notify/Logger.js';
import type { CloudImageCleanupConfig } from './CloudImageCleanupConfig.js';
import { createCloudImageCleanup } from './createCloudImageCleanup.js';
import { formatCloudImageCleanupResult } from './formatCloudImageCleanupResult.js';

/** Runs the cloud image cleanup once. Without `apply` it only counts the orphans and deletes nothing. Returns the text to print. */
export async function runCloudImageCleanupCommand(
  config: CloudImageCleanupConfig,
  apply: boolean,
  logger: Logger,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const result = await createCloudImageCleanup(config, logger, fetchFn).run(apply);
  return formatCloudImageCleanupResult(result);
}
