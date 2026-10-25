import type { SyncConfig } from './SyncConfig.js';

const REQUIRED = [
  'JELLYFIN_URL',
  'JELLYFIN_TOKEN',
  'JELLYSTAT_DB_HOST',
  'JELLYSTAT_DB_PASSWORD',
] as const;

export interface SyncConfigResult {
  config: SyncConfig | undefined;
  /** Names of the required variables that are not set. Empty when syncing is configured. */
  missing: string[];
}

/** Reads the Jellyfin sync settings from the environment. Syncing is off unless all required ones are set. */
export function loadSyncConfig(env: Record<string, string | undefined>): SyncConfigResult {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) return { config: undefined, missing };
  const port = Number(env.JELLYSTAT_DB_PORT ?? 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid JELLYSTAT_DB_PORT: ${env.JELLYSTAT_DB_PORT}`);
  }
  return {
    missing: [],
    config: {
      jellyfin: { url: env.JELLYFIN_URL!, token: env.JELLYFIN_TOKEN! },
      jellystat: {
        host: env.JELLYSTAT_DB_HOST!,
        port,
        user: env.JELLYSTAT_DB_USER || 'postgres',
        password: env.JELLYSTAT_DB_PASSWORD!,
        database: env.JELLYSTAT_DB_NAME || 'jellystat',
      },
      userName: env.JELLYFIN_USER || 'admin',
      timeZone: env.SYNC_TIME_ZONE || 'Europe/Madrid',
    },
  };
}
