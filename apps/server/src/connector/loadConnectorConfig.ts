import { loadSyncConfig } from '../sync/loadSyncConfig.js';
import type { ConnectorConfig } from './ConnectorConfig.js';

export interface ConnectorConfigResult {
  config: ConnectorConfig | undefined;
  /** Names of the required variables that are not set. Empty when the connector is configured. */
  missing: string[];
}

const DEFAULT_PASS_HOURS = 6;

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
  return {
    missing: [],
    config: {
      cloudUrl: cloudUrl.toString().replace(/\/+$/, ''),
      token: env.METRACK_CONNECTOR_TOKEN!,
      sync,
      dataDir: env.CONNECTOR_DATA_DIR || defaultDataDir,
      passIntervalMs: hours * 3_600_000,
    },
  };
}
