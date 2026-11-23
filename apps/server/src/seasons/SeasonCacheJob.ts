import type { Logger } from '../notify/Logger.js';
import type { UserRepository } from '../storage/repositories/UserRepository.js';
import type { UserScope } from '../users/UserScope.js';
import type { SeasonCacheChecker } from './SeasonCacheChecker.js';

/** The most series of one user a pass checks. */
export const SEASON_CACHE_SERIES_PER_USER = 5;

/**
 * Compares every user's season entries with their episodes, a few series at a time, and logs what differs. It only
 * reports: nothing is ever rewritten by the job. Each pass moves on through the series by the hour it runs in, so
 * repeated passes cover them all.
 */
export class SeasonCacheJob {
  constructor(
    private readonly users: Pick<UserRepository, 'list'>,
    private readonly scope: UserScope,
    private readonly checker: SeasonCacheChecker,
    private readonly logger: Logger,
  ) {}

  /** Runs one pass and answers how many season entries differ from their episodes. */
  async run(now: Date): Promise<number> {
    const hour = Math.floor(now.getTime() / 3_600_000);
    let differing = 0;
    for (const user of await this.users.list()) {
      const report = await this.scope.run(user.id, () =>
        this.checker.run(false, {
          offset: hour * SEASON_CACHE_SERIES_PER_USER,
          limit: SEASON_CACHE_SERIES_PER_USER,
        }),
      );
      for (const drift of report.drifts) {
        differing += 1;
        this.logger.error(
          `season cache differs: user ${user.id} season ${drift.seasonId} ${drift.fields.join(',')}`,
        );
      }
    }
    return differing;
  }
}
