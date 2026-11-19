import type { UserSettings } from '@metrack/domain';

/** The environment variable each owner setting starts from. */
export const SETTING_VARIABLES: Record<keyof UserSettings, string> = {
  jellyfinUser: 'JELLYFIN_USER',
  ntfyTopic: 'NTFY_TOPIC',
  mirrorDir: 'VAULT_MIRROR_DIR',
  mirrorLinkPrefix: 'VAULT_MIRROR_LINK_PREFIX',
};
