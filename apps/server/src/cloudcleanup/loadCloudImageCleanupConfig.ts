import type { CloudBackupConfig } from '../cloudbackup/CloudBackupConfig.js';
import type { CloudImageCleanupConfig } from './CloudImageCleanupConfig.js';

const DEFAULT_MAX_FRACTION = 0.5;
const DEFAULT_MAX_COUNT = 1000;

/**
 * The orphan image cleanup settings: the cloud backup's D1 and R2 access plus the limits of one run. Undefined
 * when the backup does not copy the images (no bucket), since the cleanup needs the same bucket access.
 */
export function loadCloudImageCleanupConfig(
  env: Record<string, string | undefined>,
  backup: CloudBackupConfig | undefined,
): CloudImageCleanupConfig | undefined {
  if (!backup?.r2) return undefined;
  const maxFraction = Number(env.CLOUD_IMAGE_CLEANUP_MAX_FRACTION || DEFAULT_MAX_FRACTION);
  if (!(maxFraction > 0 && maxFraction <= 1)) {
    throw new Error(
      `Invalid CLOUD_IMAGE_CLEANUP_MAX_FRACTION: ${env.CLOUD_IMAGE_CLEANUP_MAX_FRACTION}`,
    );
  }
  const maxCount = Number(env.CLOUD_IMAGE_CLEANUP_MAX_COUNT || DEFAULT_MAX_COUNT);
  if (!Number.isInteger(maxCount) || maxCount < 1) {
    throw new Error(`Invalid CLOUD_IMAGE_CLEANUP_MAX_COUNT: ${env.CLOUD_IMAGE_CLEANUP_MAX_COUNT}`);
  }
  return { d1: backup.d1, r2: backup.r2, maxFraction, maxCount };
}
