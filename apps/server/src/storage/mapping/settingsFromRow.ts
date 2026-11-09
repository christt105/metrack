import type { UserSettings } from '@metrack/domain';
import type { Row } from './Row.js';
import { text } from './rowMapping.js';

export function settingsFromRow(row: Row): UserSettings {
  return {
    jellyfinUser: text(row.jellyfin_user),
    ntfyTopic: text(row.ntfy_topic),
    publishProject: text(row.publish_project),
    publishBaseUrl: text(row.publish_base_url),
    mirrorDir: text(row.mirror_dir),
    mirrorLinkPrefix: text(row.mirror_link_prefix),
  };
}
