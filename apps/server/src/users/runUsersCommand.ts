import { join } from 'node:path';
import { applySettingsPatch, type User, type UserSettings } from '@metrack/domain';
import { MigrationRunner } from '../storage/MigrationRunner.js';
import { migrations } from '../storage/migrations/index.js';
import { openDatabase } from '../storage/sqlite/openDatabase.js';
import { SqliteUserRepository } from '../storage/sqlite/SqliteUserRepository.js';
import { SqliteUserSettingsRepository } from '../storage/sqlite/SqliteUserSettingsRepository.js';
import { NO_SETTINGS } from './NO_SETTINGS.js';

export interface UsersCommand {
  dataDir: string;
  /** Lists the users when neither this nor `set` is given. */
  add?: { name: string; email: string | null };
  /** Changes some of a user's settings; an empty string clears one. With no changes it only shows them. */
  set?: { userId: number; changes: Partial<Record<keyof UserSettings, string>> };
}

/** Runs `metrack users` (list), `metrack users add <name> [--email <address>]` and `metrack users set <id> [...]`. */
export async function runUsersCommand(command: UsersCommand): Promise<string> {
  const db = openDatabase(join(command.dataDir, 'metrack.db'));
  try {
    new MigrationRunner(db, migrations).run();
    const users = new SqliteUserRepository(db);
    const settings = new SqliteUserSettingsRepository(db);
    if (command.add) return `Created ${describe(await users.create(command.add))}`;
    if (command.set) {
      const { userId, changes } = command.set;
      const user = await users.get(userId);
      if (!user) throw new Error(`There is no user ${userId}`);
      const result = applySettingsPatch((await settings.get(userId)) ?? NO_SETTINGS, changes);
      if (!result.ok) {
        const problems = Object.entries(result.problems).map(
          ([key, problem]) => `${key}: ${problem}`,
        );
        throw new Error(`Invalid settings: ${problems.join('; ')}`);
      }
      if (Object.keys(changes).length > 0) await settings.save(userId, result.settings);
      return `${describe(user)}\n${describeSettings(result.settings)}`;
    }
    const stored = new Map((await settings.list()).map((entry) => [entry.userId, entry.settings]));
    return (await users.list())
      .map((user) => `${describe(user)}  ${enabledJobs(stored.get(user.id) ?? NO_SETTINGS)}`)
      .join('\n');
  } finally {
    db.close();
  }
}

function describe(user: User): string {
  return `${user.id}  ${user.name}${user.email ? `  <${user.email}>` : ''}`;
}

function enabledJobs(settings: UserSettings): string {
  const jobs = [
    settings.jellyfinUser && 'sync',
    settings.ntfyTopic && 'alerts',
    settings.publishProject && 'publish',
    settings.mirrorDir && 'mirror',
  ].filter(Boolean);
  return jobs.length > 0 ? `[${jobs.join(', ')}]` : '[no jobs]';
}

function describeSettings(settings: UserSettings): string {
  return Object.entries(settings)
    .map(([key, value]) => `  ${key}: ${value ?? '-'}`)
    .join('\n');
}
