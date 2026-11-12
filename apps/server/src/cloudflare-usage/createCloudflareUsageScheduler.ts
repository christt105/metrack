import { join } from 'node:path';
import type { Logger } from '../notify/Logger.js';
import type { NtfyConfig } from '../notify/NtfyConfig.js';
import { NtfyNotifier } from '../notify/NtfyNotifier.js';
import { CloudflareUsageClient } from './CloudflareUsageClient.js';
import { CloudflareUsageMonitor } from './CloudflareUsageMonitor.js';
import { CloudflareUsageScheduler } from './CloudflareUsageScheduler.js';
import { loadCloudflareUsageConfig } from './loadCloudflareUsageConfig.js';
import { UsageStateStore } from './UsageStateStore.js';

/** Builds the scheduler when the token, the account id and an owner ntfy target are all set. */
export function createCloudflareUsageScheduler(
  env: Record<string, string | undefined>,
  ntfy: NtfyConfig | undefined,
  dataDir: string,
  logger: Logger,
): CloudflareUsageScheduler | undefined {
  const config = loadCloudflareUsageConfig(env);
  if (!config) return undefined;
  if (!ntfy) {
    logger.info(
      'Cloudflare usage alerts are off: they need NTFY_URL and NTFY_TOPIC besides the token',
    );
    return undefined;
  }
  const monitor = new CloudflareUsageMonitor(
    new CloudflareUsageClient(config.token, config.accountId),
    config,
    new UsageStateStore(join(dataDir, 'cloudflare-usage-state.json')),
    new NtfyNotifier(ntfy, logger),
    logger,
  );
  return new CloudflareUsageScheduler(monitor, logger);
}
