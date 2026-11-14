import { loadSyncConfig } from '../sync/loadSyncConfig.js';
import { loadCloudBackupConfig } from '../cloudbackup/loadCloudBackupConfig.js';
import type { ReleaseAlertsConfig } from './ReleaseAlertsConfig.js';
import type { ConnectorConfig } from './ConnectorConfig.js';

export interface ConnectorConfigResult {
  config: ConnectorConfig | undefined;
  /** Names of the required variables that are not set. Empty when the connector is configured. */
  missing: string[];
}

const DEFAULT_PASS_HOURS = 6;
const DEFAULT_ALERTS_NTFY_URL = 'https://ntfy.sh';
const DEFAULT_ALERTS_FROM_HOUR = 9;
const DEFAULT_ALERTS_TICK_MINUTES = 5;
const DEFAULT_ALERTS_DAILY_LIMIT = 200;

function numberFrom(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
  valid: (value: number) => boolean,
): number {
  const value = Number(env[name] || fallback);
  if (!Number.isFinite(value) || !valid(value)) throw new Error(`Invalid ${name}: ${env[name]}`);
  return value;
}

function loadReleaseAlerts(
  env: Record<string, string | undefined>,
): ReleaseAlertsConfig | undefined {
  if (env.CONNECTOR_RELEASE_ALERTS !== 'true') return undefined;
  const ntfyUrl = env.CONNECTOR_RELEASE_NTFY_URL || DEFAULT_ALERTS_NTFY_URL;
  try {
    new URL(ntfyUrl);
  } catch {
    throw new Error(`Invalid CONNECTOR_RELEASE_NTFY_URL: ${ntfyUrl}`);
  }
  return {
    ntfyUrl,
    notifyFromHour: numberFrom(
      env,
      'CONNECTOR_RELEASE_FROM_HOUR',
      DEFAULT_ALERTS_FROM_HOUR,
      (v) => Number.isInteger(v) && v >= 0 && v <= 23,
    ),
    tickMs:
      numberFrom(
        env,
        'CONNECTOR_RELEASE_TICK_MINUTES',
        DEFAULT_ALERTS_TICK_MINUTES,
        (v) => v >= 1 && v <= 1440,
      ) * 60_000,
    dailyLimit: numberFrom(
      env,
      'CONNECTOR_RELEASE_DAILY_LIMIT',
      DEFAULT_ALERTS_DAILY_LIMIT,
      (v) => Number.isInteger(v) && v >= 1,
    ),
  };
}

/** Reads the connector settings from the environment. `defaultDataDir` is used when `CONNECTOR_DATA_DIR` is not set. */
export function loadConnectorConfig(
  env: Record<string, string | undefined>,
  defaultDataDir: string,
): ConnectorConfigResult {
  const own = ['METRACK_URL', 'METRACK_CONNECTOR_TOKEN'].filter((name) => !env[name]);
  const { config: sync, missing: syncMissing } = loadSyncConfig(env);
  const missing = [...own, ...syncMissing];
  if (missing.length > 0 || !sync) return { config: undefined, missing };
  const hours = Number(env.CONNECTOR_PASS_HOURS ?? DEFAULT_PASS_HOURS);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
    throw new Error(`Invalid CONNECTOR_PASS_HOURS: ${env.CONNECTOR_PASS_HOURS}`);
  }
  let cloudUrl: URL;
  try {
    cloudUrl = new URL(env.METRACK_URL!);
  } catch {
    throw new Error(`Invalid METRACK_URL: ${env.METRACK_URL}`);
  }
  const cloudBackup = loadCloudBackupConfig(env);
  if (cloudBackup.missing.length > 0) {
    throw new Error(
      `The cloud backup is partly configured, missing: ${cloudBackup.missing.join(', ')}`,
    );
  }
  return {
    missing: [],
    config: {
      cloudUrl: cloudUrl.toString().replace(/\/+$/, ''),
      token: env.METRACK_CONNECTOR_TOKEN!,
      sync,
      dataDir: env.CONNECTOR_DATA_DIR || defaultDataDir,
      passIntervalMs: hours * 3_600_000,
      releaseAlerts: loadReleaseAlerts(env),
      cloudBackup: cloudBackup.config,
    },
  };
}
