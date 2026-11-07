import { loadSyncConfig } from '../sync/loadSyncConfig.js';
import type { UserSettings } from './UserSettings.js';

/** The settings the owner's jobs used when they were configured only through the environment. */
export function ownerSettingsFromEnv(env: Record<string, string | undefined>): UserSettings {
  const syncConfigured = loadSyncConfig(env).config !== undefined;
  return {
    jellyfinUser: env.JELLYFIN_USER || (syncConfigured ? 'admin' : null),
    ntfyTopic: env.NTFY_TOPIC || null,
    publishProject: env.CLOUDFLARE_PAGES_PROJECT || null,
    publishBaseUrl: env.PUBLISH_BASE_URL || null,
    mirrorDir: env.VAULT_MIRROR_DIR || null,
    mirrorLinkPrefix: env.VAULT_MIRROR_LINK_PREFIX || null,
  };
}
