import type { CloudBackupConfigResult } from './CloudBackupConfigResult.js';
import type { R2Config } from './R2Config.js';

const DEFAULT_RETENTION = 14;
const DEFAULT_TIME = '04:30';
const REQUIRED = [
  'CLOUD_BACKUP_DIR',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUD_BACKUP_D1_DATABASE_ID',
  'CLOUD_BACKUP_D1_TOKEN',
] as const;
const R2_REQUIRED = ['CLOUD_BACKUP_R2_ACCESS_KEY_ID', 'CLOUD_BACKUP_R2_SECRET_ACCESS_KEY'] as const;

/**
 * Reads the cloud backup settings. The feature is off unless a database and a folder are given; when only some
 * of the required variables are set, `missing` names the rest.
 */
export function loadCloudBackupConfig(
  env: Record<string, string | undefined>,
): CloudBackupConfigResult {
  const dbOrDir = ['CLOUD_BACKUP_DIR', 'CLOUD_BACKUP_D1_DATABASE_ID', 'CLOUD_BACKUP_D1_TOKEN'];
  if (!dbOrDir.some((name) => env[name])) return { config: undefined, missing: [] };
  const r2Wanted = Boolean(env.CLOUD_BACKUP_R2_BUCKET);
  const missing = [
    ...REQUIRED.filter((name) => !env[name]),
    ...(r2Wanted ? R2_REQUIRED.filter((name) => !env[name]) : []),
  ];
  if (missing.length > 0) return { config: undefined, missing };
  const retention = Number(env.CLOUD_BACKUP_RETENTION || DEFAULT_RETENTION);
  if (!Number.isInteger(retention) || retention < 1) {
    throw new Error(`Invalid CLOUD_BACKUP_RETENTION: ${env.CLOUD_BACKUP_RETENTION}`);
  }
  const time = /^(\d{1,2}):(\d{2})$/.exec(env.CLOUD_BACKUP_TIME || DEFAULT_TIME);
  const hour = Number(time?.[1]);
  const minute = Number(time?.[2]);
  if (!time || hour > 23 || minute > 59) {
    throw new Error(`Invalid CLOUD_BACKUP_TIME: ${env.CLOUD_BACKUP_TIME}`);
  }
  const accountId = env.CLOUDFLARE_ACCOUNT_ID!;
  return {
    missing: [],
    config: {
      dir: env.CLOUD_BACKUP_DIR!,
      retention,
      time: { hour, minute },
      d1: {
        accountId,
        databaseId: env.CLOUD_BACKUP_D1_DATABASE_ID!,
        token: env.CLOUD_BACKUP_D1_TOKEN!,
      },
      r2: r2Wanted ? r2From(env, accountId) : undefined,
    },
  };
}

function r2From(env: Record<string, string | undefined>, accountId: string): R2Config {
  const endpoint = env.CLOUD_BACKUP_R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
  try {
    new URL(endpoint);
  } catch {
    throw new Error(`Invalid CLOUD_BACKUP_R2_ENDPOINT: ${endpoint}`);
  }
  return {
    bucket: env.CLOUD_BACKUP_R2_BUCKET!,
    accessKeyId: env.CLOUD_BACKUP_R2_ACCESS_KEY_ID!,
    secretAccessKey: env.CLOUD_BACKUP_R2_SECRET_ACCESS_KEY!,
    endpoint: endpoint.replace(/\/+$/, ''),
  };
}
