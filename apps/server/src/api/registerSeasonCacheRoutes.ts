import type { SeasonCacheChecker } from '../seasons/SeasonCacheChecker.js';
import type { SeasonCacheReport } from '../seasons/SeasonCacheReport.js';
import type { ApiRoutes } from './ApiRoutes.js';

/**
 * `GET /api/season-cache` lists the season entries of the user whose stored status, dates, rewatches or counters
 * differ from what their episodes say, and changes nothing. `POST /api/season-cache/repair` rewrites those entries
 * from their episodes and answers what it rewrote; it is a write, so a read-only token is refused and the content
 * version is bumped by the usual write path.
 */
export function registerSeasonCacheRoutes(routes: ApiRoutes, checker: SeasonCacheChecker): void {
  routes.get('/api/season-cache', async (): Promise<SeasonCacheReport> => checker.run(false));

  routes.post('/api/season-cache/repair', async (): Promise<SeasonCacheReport> =>
    checker.run(true),
  );
}
