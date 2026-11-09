import type { UserSettings } from '@metrack/domain';
import { settingsFromRow } from '../mapping/settingsFromRow.js';
import type { UserSettingsRepository } from '../repositories/UserSettingsRepository.js';
import type { D1Database } from './D1Database.js';
import { execute, queryAll, queryFirst } from './d1Query.js';

export class D1UserSettingsRepository implements UserSettingsRepository {
  constructor(private readonly db: D1Database) {}

  async get(userId: number): Promise<UserSettings | undefined> {
    const row = await queryFirst(this.db, 'SELECT * FROM user_setting WHERE user_id = ?', userId);
    return row ? settingsFromRow(row) : undefined;
  }

  async save(userId: number, settings: UserSettings): Promise<void> {
    await execute(
      this.db,
      `INSERT INTO user_setting
           (user_id, jellyfin_user, ntfy_topic, publish_project, publish_base_url, mirror_dir, mirror_link_prefix)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET
           jellyfin_user = excluded.jellyfin_user,
           ntfy_topic = excluded.ntfy_topic,
           publish_project = excluded.publish_project,
           publish_base_url = excluded.publish_base_url,
           mirror_dir = excluded.mirror_dir,
           mirror_link_prefix = excluded.mirror_link_prefix`,
      userId,
      settings.jellyfinUser,
      settings.ntfyTopic,
      settings.publishProject,
      settings.publishBaseUrl,
      settings.mirrorDir,
      settings.mirrorLinkPrefix,
    );
  }

  /** Reads every user's settings; for scheduled jobs only, cache it (nr8fn1). */
  async list(): Promise<{ userId: number; settings: UserSettings }[]> {
    const rows = await queryAll(this.db, 'SELECT * FROM user_setting ORDER BY user_id');
    return rows.map((row) => ({ userId: Number(row.user_id), settings: settingsFromRow(row) }));
  }
}
