import type { Language, UserSettings } from '@metrack/domain';
import type { Row } from './Row.js';
import { text } from './rowMapping.js';

function language(value: unknown): Language | null {
  return value === 'es' || value === 'en' ? value : null;
}

export function settingsFromRow(row: Row): UserSettings {
  return {
    jellyfinUser: text(row.jellyfin_user),
    ntfyTopic: text(row.ntfy_topic),
    mirrorDir: text(row.mirror_dir),
    mirrorLinkPrefix: text(row.mirror_link_prefix),
    language: language(row.language),
  };
}
