import type { NextEpisodesResponse } from '@metrack/domain';
import type { NextEpisodesService } from '../seasons/NextEpisodesService.js';
import type { ApiRoutes } from './ApiRoutes.js';
import { nextQuery } from './schemas/nextQuery.js';

/**
 * `GET /api/next` answers with the episode that is next for each series of the user, the one watched most recently
 * first; `series` narrows it to that series, with an empty list when nothing is next for it. It only reads stored
 * data, so a read-only token can use it.
 */
export function registerNextEpisodeRoutes(routes: ApiRoutes, next: NextEpisodesService): void {
  routes.get<{ Querystring: { series?: number } }>(
    '/api/next',
    { schema: { querystring: nextQuery } },
    async (request): Promise<NextEpisodesResponse> => next.list(request.query.series),
  );
}
