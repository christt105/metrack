import { join } from 'node:path';
import type { Config } from './Config.js';

/** Reads the service configuration from an environment-like object. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const port = Number(env.PORT ?? 8097);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${env.PORT}`);
  }
  const dataDir = env.DATA_DIR ?? './data';
  const config: Config = {
    port,
    host: env.HOST ?? '0.0.0.0',
    dataDir,
    webDir: env.WEB_DIR ?? '../web/dist',
    appVersion: env.APP_VERSION ?? 'dev',
    tmdbApiKey: env.TMDB_API_KEY || undefined,
    tmdbLanguage: env.TMDB_LANGUAGE ?? 'es-ES',
    steamGridDbToken: env.STEAMGRIDDB_TOKEN || undefined,
    backup: {
      enabled: env.BACKUP_ENABLED !== 'false',
      dir: env.BACKUP_DIR || join(dataDir, 'backups'),
      retention: positiveInteger(env, 'BACKUP_RETENTION', 14),
      intervalHours: positiveInteger(env, 'BACKUP_INTERVAL_HOURS', 24),
    },
    alerts: {
      enabled: env.ALERTS_ENABLED !== 'false',
      timeZone: env.ALERTS_TIMEZONE ?? 'Europe/Madrid',
      notifyFromHour: hour(env, 'ALERTS_NOTIFY_FROM_HOUR', 8),
    },
  };
  if (env.NTFY_URL && env.NTFY_TOPIC) {
    config.ntfy = { url: env.NTFY_URL, topic: env.NTFY_TOPIC, token: env.NTFY_TOKEN || undefined };
  }
  return config;
}

function positiveInteger(
  env: Record<string, string | undefined>,
  key: string,
  fallback: number,
): number {
  const raw = env[key];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid ${key}: ${raw}`);
  }
  return value;
}

function hour(env: Record<string, string | undefined>, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 23) {
    throw new Error(`Invalid ${key}: ${raw}`);
  }
  return value;
}
