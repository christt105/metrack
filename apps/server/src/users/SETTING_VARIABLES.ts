import type { UserSettings } from './UserSettings.js';

/** The environment variable each owner setting starts from. */
export const SETTING_VARIABLES: Record<keyof UserSettings, string> = {
  jellyfinUser: 'JELLYFIN_USER',
  ntfyTopic: 'NTFY_TOPIC',
  publishProject: 'CLOUDFLARE_PAGES_PROJECT',
  publishBaseUrl: 'PUBLISH_BASE_URL',
  mirrorDir: 'VAULT_MIRROR_DIR',
  mirrorLinkPrefix: 'VAULT_MIRROR_LINK_PREFIX',
};
