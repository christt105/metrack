import { join } from 'node:path';
import { createImageStore } from '../images/createImageStore.js';
import type { FetchFn } from '../http/FetchFn.js';
import type { Logger } from '../notify/Logger.js';
import type { NtfyServer } from '../notify/NtfyServer.js';
import { UserNotifier } from '../notify/UserNotifier.js';
import { MigrationRunner } from '../storage/MigrationRunner.js';
import { migrations } from '../storage/migrations/index.js';
import { createSqliteRepositories } from '../storage/sqlite/createSqliteRepositories.js';
import { openDatabase } from '../storage/sqlite/openDatabase.js';
import { FixedUserScope } from '../users/FixedUserScope.js';
import { AccountDeletionService } from './AccountDeletionService.js';
import { AccountExporter } from './AccountExporter.js';
import type { AccountTools } from './AccountTools.js';

/**
 * Opens the database and image store of a data directory with the export and deletion services, acting as
 * one user. Users are told about a deletion through the ntfy topic in their settings when a server is given.
 */
export function openAccountTools(
  dataDir: string,
  userId: number,
  options: { ntfy?: NtfyServer; logger?: Logger; fetchFn?: FetchFn; now?: () => Date } = {},
): AccountTools {
  const db = openDatabase(join(dataDir, 'metrack.db'));
  new MigrationRunner(db, migrations).run();
  const repositories = createSqliteRepositories(db, new FixedUserScope(userId));
  const images = createImageStore(db, join(dataDir, 'images'));
  const logger = options.logger ?? { info: console.log, error: console.error };
  return {
    db,
    exporter: new AccountExporter({ ...repositories, images }, options.now),
    deletion: new AccountDeletionService(
      repositories.accounts,
      repositories.users,
      images,
      dataDir,
      logger,
      options.now,
      (id) => new UserNotifier(repositories.settings, id, options.ntfy, logger, options.fetchFn),
    ),
  };
}
