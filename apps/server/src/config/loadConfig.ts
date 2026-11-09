import { join } from 'node:path';
import type { ImageEncodingSite } from '@metrack/domain';
import type { Config } from './Config.js';

const MB = 1024 * 1024;

/** Reads the service configuration from an environment-like object. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const port = Number(env.PORT ?? 8097);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${env.PORT}`);
  }
  const dataDir = env.DATA_DIR ?? './data';
  const tmdbLanguage = env.TMDB_LANGUAGE ?? 'es-ES';
  const config: Config = {
    port,
    host: env.HOST ?? '0.0.0.0',
    dataDir,
    webDir: env.WEB_DIR ?? '../web/dist',
    appVersion: env.APP_VERSION ?? 'dev',
    devLogin: env.DEV_LOGIN === 'true',
    tmdbApiKey: env.TMDB_API_KEY || undefined,
    tmdbLanguage,
    openLibraryLanguage: env.OPENLIBRARY_LANGUAGE || tmdbLanguage.slice(0, 2),
    steamGridDbToken: env.STEAMGRIDDB_TOKEN || undefined,
    backup: {
      enabled: env.BACKUP_ENABLED !== 'false',
      dir: env.BACKUP_DIR || join(dataDir, 'backups'),
      retention: positiveInteger(env, 'BACKUP_RETENTION', 14),
      intervalHours: positiveInteger(env, 'BACKUP_INTERVAL_HOURS', 24),
    },
    images: {
      quotaBytes: positiveInteger(env, 'IMAGE_QUOTA_MB', 200) * MB,
      maxUploadBytes: positiveInteger(env, 'IMAGE_UPLOAD_MAX_MB', 5) * MB,
      encodedBy: imageEncodingSite(env),
      maxDimension: positiveInteger(env, 'IMAGE_MAX_DIMENSION', 1920),
      quality: Math.min(positiveInteger(env, 'IMAGE_WEBP_QUALITY', 82), 100),
    },
    alerts: {
      enabled: env.ALERTS_ENABLED !== 'false',
      timeZone: env.ALERTS_TIMEZONE ?? 'Europe/Madrid',
      notifyFromHour: hour(env, 'ALERTS_NOTIFY_FROM_HOUR', 8),
    },
    contactEmail: env.CONTACT_EMAIL || 'christt105@gmail.com',
    publicUrl: env.PUBLIC_URL?.replace(/\/+$/, '') || null,
    mirrorWebUrl: env.VAULT_MIRROR_WEB_URL || null,
  };
  if (env.BACKUP_COPY_DIR) {
    config.backup.copy = {
      dir: env.BACKUP_COPY_DIR,
      retention: positiveInteger(env, 'BACKUP_COPY_RETENTION', 14),
    };
  }
  if (env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET) {
    config.igdb = { clientId: env.IGDB_CLIENT_ID, clientSecret: env.IGDB_CLIENT_SECRET };
  }
  if (env.NTFY_URL) {
    config.ntfyServer = { url: env.NTFY_URL, token: env.NTFY_TOKEN || undefined };
    if (env.NTFY_TOPIC) config.ntfy = { ...config.ntfyServer, topic: env.NTFY_TOPIC };
  }
  return config;
}

function imageEncodingSite(env: Record<string, string | undefined>): ImageEncodingSite {
  const raw = env.IMAGE_ENCODED_BY;
  if (raw === undefined || raw === '') return 'server';
  if (raw !== 'server' && raw !== 'client') throw new Error(`Invalid IMAGE_ENCODED_BY: ${raw}`);
  return raw;
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
