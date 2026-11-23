import { join } from 'node:path';
import { MigrationRunner } from '../storage/MigrationRunner.js';
import { migrations } from '../storage/migrations/index.js';
import { createSqliteRepositories } from '../storage/sqlite/createSqliteRepositories.js';
import { openDatabase } from '../storage/sqlite/openDatabase.js';
import { AsyncUserScope } from '../users/AsyncUserScope.js';
import { formatSeasonCacheReport } from './formatSeasonCacheReport.js';
import { SeasonCacheChecker } from './SeasonCacheChecker.js';
import type { SeasonCacheDrift } from './SeasonCacheDrift.js';
import { SeriesWatchTracker } from './SeriesWatchTracker.js';

export interface SeasonCacheCommand {
  dataDir: string;
  /** The user to check; every user when undefined. */
  userId?: number;
  /** Rewrite the entries that differ instead of only listing them. */
  repair: boolean;
}

/** Runs `metrack season-cache`: lists the season entries that differ from their episodes, and with `--repair` rewrites them. */
export async function runSeasonCacheCommand(command: SeasonCacheCommand): Promise<string> {
  const db = openDatabase(join(command.dataDir, 'metrack.db'));
  try {
    new MigrationRunner(db, migrations).run();
    const scope = new AsyncUserScope();
    const repositories = createSqliteRepositories(db, scope);
    const checker = new SeasonCacheChecker(
      repositories.seasons,
      new SeriesWatchTracker({
        seasons: repositories.seasons,
        catalog: repositories.seasonEpisodes,
        watches: repositories.episodeWatches,
      }),
    );
    const users = (await repositories.users.list())
      .map((user) => user.id)
      .filter((id) => command.userId === undefined || id === command.userId);
    const entries: { userId: number; drift: SeasonCacheDrift }[] = [];
    let seriesChecked = 0;
    for (const userId of users) {
      const report = await scope.run(userId, () => checker.run(command.repair));
      seriesChecked += report.seriesChecked;
      entries.push(...report.drifts.map((drift) => ({ userId, drift })));
    }
    return formatSeasonCacheReport(entries, seriesChecked, command.repair);
  } finally {
    db.close();
  }
}
