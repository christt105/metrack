import type { DatabaseSync } from 'node:sqlite';
import type { UserSettings } from '@metrack/domain';
import type { UserSettingsRepository } from '../repositories/UserSettingsRepository.js';
import { settingsFromRow } from '../mapping/settingsFromRow.js';

export class SqliteUserSettingsRepository implements UserSettingsRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(userId: number): Promise<UserSettings | undefined> {
    const row = this.db.prepare('SELECT * FROM user_setting WHERE user_id = ?').get(userId);
    return row ? settingsFromRow(row) : undefined;
  }

  async save(userId: number, settings: UserSettings): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO user_setting
           (user_id, jellyfin_user, ntfy_topic, mirror_dir, mirror_link_prefix, language, steam_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET
           jellyfin_user = excluded.jellyfin_user,
           ntfy_topic = excluded.ntfy_topic,
           mirror_dir = excluded.mirror_dir,
           mirror_link_prefix = excluded.mirror_link_prefix,
           language = excluded.language,
           steam_id = excluded.steam_id`,
      )
      .run(
        userId,
        settings.jellyfinUser,
        settings.ntfyTopic,
        settings.mirrorDir,
        settings.mirrorLinkPrefix,
        settings.language,
        settings.steamId,
      );
  }

  async list(): Promise<{ userId: number; settings: UserSettings }[]> {
    return this.db
      .prepare('SELECT * FROM user_setting ORDER BY user_id')
      .all()
      .map((row) => ({ userId: Number(row.user_id), settings: settingsFromRow(row) }));
  }
}
