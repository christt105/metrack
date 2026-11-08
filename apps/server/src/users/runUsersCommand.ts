import { join } from 'node:path';
import {
  ASSIGNABLE_ROLES,
  applySettingsPatch,
  handleProblem,
  normalizeHandle,
  type PublicPage,
  type User,
  type UserRole,
  type UserSettings,
} from '@metrack/domain';
import { MigrationRunner } from '../storage/MigrationRunner.js';
import { migrations } from '../storage/migrations/index.js';
import { openDatabase } from '../storage/sqlite/openDatabase.js';
import type { PublicProfileRepository } from '../storage/repositories/PublicProfileRepository.js';
import { SqlitePublicProfileRepository } from '../storage/sqlite/SqlitePublicProfileRepository.js';
import { SqliteUserRepository } from '../storage/sqlite/SqliteUserRepository.js';
import { SqliteUserSettingsRepository } from '../storage/sqlite/SqliteUserSettingsRepository.js';
import { NO_SETTINGS } from './NO_SETTINGS.js';
import { OWNER_ID } from './OWNER_ID.js';

export interface UsersCommand {
  dataDir: string;
  /** Lists the users when neither this nor `set` is given. */
  add?: { name: string; email: string | null };
  /**
   * Changes some of a user's settings (an empty string clears one) and optionally their role. With no
   * changes it only shows them.
   */
  set?: {
    userId: number;
    changes: Partial<Record<keyof UserSettings, string>>;
    role?: string;
    /** The public page handle; an empty string clears it. */
    handle?: string;
    publicPage?: boolean;
  };
}

/** Runs `metrack users` (list), `metrack users add <name> [--email <address>]` and `metrack users set <id> [...]`. */
export async function runUsersCommand(command: UsersCommand): Promise<string> {
  const db = openDatabase(join(command.dataDir, 'metrack.db'));
  try {
    new MigrationRunner(db, migrations).run();
    const users = new SqliteUserRepository(db);
    const settings = new SqliteUserSettingsRepository(db);
    const profiles = new SqlitePublicProfileRepository(db);
    if (command.add) return `Created ${describe(await users.create(command.add))}`;
    if (command.set) {
      const { userId, changes, role, handle, publicPage } = command.set;
      let user = await users.get(userId);
      if (!user) throw new Error(`There is no user ${userId}`);
      if (role !== undefined && !ASSIGNABLE_ROLES.includes(role as UserRole)) {
        throw new Error(`Role must be one of ${ASSIGNABLE_ROLES.join(', ')}`);
      }
      if (role !== undefined && userId === OWNER_ID) {
        throw new Error('User 1 is always the owner');
      }
      const result = applySettingsPatch((await settings.get(userId)) ?? NO_SETTINGS, changes);
      if (!result.ok) {
        const problems = Object.entries(result.problems).map(
          ([key, problem]) => `${key}: ${problem}`,
        );
        throw new Error(`Invalid settings: ${problems.join('; ')}`);
      }
      if (Object.keys(changes).length > 0) await settings.save(userId, result.settings);
      if (role !== undefined) {
        await users.setRole(userId, role as UserRole);
        user = { ...user, role: role as UserRole };
      }
      if (handle !== undefined || publicPage !== undefined) {
        await changePublicPage(profiles, userId, handle, publicPage);
      }
      return `${describe(user)}\n${describeSettings(result.settings)}\n${describePublicPage(await profiles.get(userId))}`;
    }
    const stored = new Map((await settings.list()).map((entry) => [entry.userId, entry.settings]));
    return (await users.list())
      .map((user) => `${describe(user)}  ${enabledJobs(stored.get(user.id) ?? NO_SETTINGS)}`)
      .join('\n');
  } finally {
    db.close();
  }
}

async function changePublicPage(
  profiles: PublicProfileRepository,
  userId: number,
  handle: string | undefined,
  publicPage: boolean | undefined,
): Promise<void> {
  const current = await profiles.get(userId);
  const wanted = handle === undefined ? current.handle : normalizeHandle(handle) || null;
  const problem = wanted === null ? null : handleProblem(wanted);
  if (problem) throw new Error(`Invalid handle: ${problem}`);
  const enabled = publicPage ?? current.enabled;
  if (enabled && wanted === null) throw new Error('A public page needs a handle');
  await profiles.save(userId, { handle: wanted, enabled });
}

function describePublicPage(page: PublicPage): string {
  return `  publicPage: ${page.enabled ? 'on' : 'off'}, handle: ${page.handle ?? '-'}`;
}

function describe(user: User): string {
  return `${user.id}  ${user.name}${user.email ? `  <${user.email}>` : ''}  ${user.role}`;
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
