import type { MirrorConfig } from './MirrorConfig.js';

/** Reads the vault mirror settings. The mirror is off unless VAULT_MIRROR_DIR is set. */
export function loadMirrorConfig(
  env: Record<string, string | undefined>,
): MirrorConfig | undefined {
  if (!env.VAULT_MIRROR_DIR) return undefined;
  return {
    mirrorDir: env.VAULT_MIRROR_DIR,
    linkPrefix: env.VAULT_MIRROR_LINK_PREFIX || 'Media Tracker',
    webUrl: env.VAULT_MIRROR_WEB_URL || null,
  };
}
