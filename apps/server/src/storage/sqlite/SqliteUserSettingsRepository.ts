import type { DatabaseSync } from 'node:sqlite';
import type { UserSettings } from '../../users/UserSettings.js';
import type { UserSettingsRepository } from '../repositories/UserSettingsRepository.js';
import type { Row } from './Row.js';
import { text } from './rowMapping.js';

export class SqliteUserSettingsRepository implements UserSettingsRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(userId: number): Promise<UserSettings | undefined> {
    const row = this.db.prepare('SELECT * FROM user_setting WHERE user_id = ?').get(userId);
    return row ? fromRow(row) : undefined;
  }

  async save(userId: number, settings: UserSettings): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO user_setting
           (user_id, jellyfin_user, ntfy_topic, publish_project, publish_base_url, mirror_dir, mirror_link_prefix)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        settings.jellyfinUser,
        settings.ntfyTopic,
        settings.publishProject,
        settings.publishBaseUrl,
        settings.mirrorDir,
        settings.mirrorLinkPrefix,
      );
  }

  async list(): Promise<{ userId: number; settings: UserSettings }[]> {
    return this.db
      .prepare('SELECT * FROM user_setting ORDER BY user_id')
      .all()
      .map((row) => ({ userId: Number(row.user_id), settings: fromRow(row) }));
  }
}

function fromRow(row: Row): UserSettings {
  return {
    jellyfinUser: text(row.jellyfin_user),
    ntfyTopic: text(row.ntfy_topic),
    publishProject: text(row.publish_project),
    publishBaseUrl: text(row.publish_base_url),
    mirrorDir: text(row.mirror_dir),
    mirrorLinkPrefix: text(row.mirror_link_prefix),
  };
}
