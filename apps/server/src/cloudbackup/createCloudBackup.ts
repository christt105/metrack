import { CloudBackup } from './CloudBackup.js';
import type { CloudBackupConfig } from './CloudBackupConfig.js';
import { D1Exporter } from './D1Exporter.js';
import { R2Client } from './R2Client.js';

/** Builds the cloud backup the settings describe. */
export function createCloudBackup(
  config: CloudBackupConfig,
  fetchFn: typeof fetch = fetch,
): CloudBackup {
  return new CloudBackup(
    config.dir,
    config.retention,
    new D1Exporter(config.d1.accountId, config.d1.databaseId, config.d1.token, fetchFn),
    config.r2 ? new R2Client(config.r2, fetchFn) : undefined,
  );
}
