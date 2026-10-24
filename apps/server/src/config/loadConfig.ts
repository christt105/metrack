import type { Config } from './Config.js';

/** Reads the service configuration from an environment-like object. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const port = Number(env.PORT ?? 8097);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${env.PORT}`);
  }
  return {
    port,
    host: env.HOST ?? '0.0.0.0',
    dataDir: env.DATA_DIR ?? './data',
    webDir: env.WEB_DIR ?? '../web/dist',
    appVersion: env.APP_VERSION ?? 'dev',
    tmdbApiKey: env.TMDB_API_KEY || undefined,
    tmdbLanguage: env.TMDB_LANGUAGE ?? 'es-ES',
    steamGridDbToken: env.STEAMGRIDDB_TOKEN || undefined,
  };
}
