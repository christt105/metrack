import { join } from 'node:path';
import type { User } from '@metrack/domain';
import { MigrationRunner } from '../storage/MigrationRunner.js';
import { migrations } from '../storage/migrations/index.js';
import { openDatabase } from '../storage/sqlite/openDatabase.js';
import { SqliteUserRepository } from '../storage/sqlite/SqliteUserRepository.js';

export interface UsersCommand {
  dataDir: string;
  /** Lists the users when missing. */
  add?: { name: string; email: string | null };
}

/** Runs `metrack users` (list) and `metrack users add <name> [--email <address>]`. */
export async function runUsersCommand(command: UsersCommand): Promise<string> {
  const db = openDatabase(join(command.dataDir, 'metrack.db'));
  try {
    new MigrationRunner(db, migrations).run();
    const users = new SqliteUserRepository(db);
    if (command.add) return `Created ${describe(await users.create(command.add))}`;
    return (await users.list()).map(describe).join('\n');
  } finally {
    db.close();
  }
}

function describe(user: User): string {
  return `${user.id}  ${user.name}${user.email ? `  <${user.email}>` : ''}`;
}
