import { writeFileSync } from 'node:fs';
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
import { openAccountTools } from '../account/openAccountTools.js';
import type { FetchFn } from '../http/FetchFn.js';
import type { NtfyServer } from '../notify/NtfyServer.js';
import { MigrationRunner } from '../storage/MigrationRunner.js';
import { migrations } from '../storage/migrations/index.js';
import { openDatabase } from '../storage/sqlite/openDatabase.js';
import type { PublicProfileRepository } from '../storage/repositories/PublicProfileRepository.js';
import { SqlitePublicProfileRepository } from '../storage/sqlite/SqlitePublicProfileRepository.js';
import { SqliteAccountRepository } from '../storage/sqlite/SqliteAccountRepository.js';
import { scheduleOf } from '../account/AccountDeletionSchedule.js';
import { SqliteUserRepository } from '../storage/sqlite/SqliteUserRepository.js';
import { SqliteUserSettingsRepository } from '../storage/sqlite/SqliteUserSettingsRepository.js';
import { NO_SETTINGS } from './NO_SETTINGS.js';
import { OWNER_ID } from './OWNER_ID.js';

export interface UsersCommand {
  dataDir: string;
  /** Lists the users when none of `add`, `set`, `delete` or `exportTo` is given. */
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
  /**
   * Schedules the user's account for deletion after the grace period, or with `cancel` withdraws the request.
   * The user is told through the ntfy topic in their settings, if they have one and a server is given.
   */
  delete?: { userId: number; cancel: boolean };
  /** Writes the user's export ZIP to a file. */
  exportTo?: { userId: number; file: string };
  ntfy?: NtfyServer;
  /** Replaces the network for the ntfy message, for tests. */
  fetchFn?: FetchFn;
}

/**
 * Runs `metrack users` (list), `metrack users add <name> [--email <address>]`, `metrack users set <id> [...]`,
 * `metrack users delete <id> [--cancel]` and `metrack users export <id> <file>`.
 */
export async function runUsersCommand(command: UsersCommand): Promise<string> {
  if (command.delete)
    return runDelete(command.dataDir, command.delete, command.ntfy, command.fetchFn);
  if (command.exportTo) return runExport(command.dataDir, command.exportTo);
  const db = openDatabase(join(command.dataDir, 'metrack.db'));
  try {
    new MigrationRunner(db, migrations).run();
    const users = new SqliteUserRepository(db);
    const settings = new SqliteUserSettingsRepository(db);
    const profiles = new SqlitePublicProfileRepository(db);
    const accounts = new SqliteAccountRepository(db);
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
    const lines: string[] = [];
    for (const user of await users.list()) {
      const jobs = enabledJobs(stored.get(user.id) ?? NO_SETTINGS);
      const requestedAt = await accounts.deletionRequestedAt(user.id);
      const deletion =
        requestedAt === null ? '' : `  deletion on ${scheduleOf(requestedAt).deleteAt}`;
      lines.push(`${describe(user)}  ${jobs}${deletion}`);
    }
    return lines.join('\n');
  } finally {
    db.close();
  }
}

async function runDelete(
  dataDir: string,
  { userId, cancel }: { userId: number; cancel: boolean },
  ntfy: NtfyServer | undefined,
  fetchFn: FetchFn | undefined,
): Promise<string> {
  const { db, deletion } = openAccountTools(dataDir, userId, { ntfy, fetchFn });
  try {
    if (cancel) {
      return (await deletion.cancel(userId, true))
        ? `Cancelled the deletion of user ${userId}`
        : `User ${userId} has no deletion waiting`;
    }
    const scheduled = await deletion.request(userId, true);
    return `User ${userId} will be deleted on ${scheduled.deleteAt} unless it is cancelled (metrack users delete ${userId} --cancel, or by signing in)`;
  } finally {
    db.close();
  }
}

async function runExport(
  dataDir: string,
  { userId, file }: { userId: number; file: string },
): Promise<string> {
  const { db, exporter } = openAccountTools(dataDir, userId);
  try {
    const archive = await exporter.build(userId);
    writeFileSync(file, archive.bytes);
    return `Wrote the export of user ${userId} to ${file} (${archive.bytes.byteLength} bytes)`;
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
