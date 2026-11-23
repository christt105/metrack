import type { NextEpisodesResponse } from '@metrack/domain';
import type { NextEpisodesService } from '../seasons/NextEpisodesService.js';
import { ApiError } from './ApiError.js';
import { noContent } from './noContent.js';
import type { ApiRoutes } from './ApiRoutes.js';
import { nextQuery } from './schemas/nextQuery.js';
import { idParams } from './schemas/mediaSchemas.js';

/**
 * `GET /api/next` answers with the episode that is next for each series of the user, the one watched most recently
 * first; `series` narrows it to that series, with an empty list when nothing is next for it. It only reads stored
 * data, so a read-only token can use it. `PUT` and `DELETE` on `/api/series/{id}/next-hidden` take a series off the
 * list, until something of it is marked or skipped, and put it back; they are writes, so a read-only token is
 * refused, and only the series of the user in scope are found.
 */
export function registerNextEpisodeRoutes(routes: ApiRoutes, next: NextEpisodesService): void {
  routes.get<{ Querystring: { series?: number } }>(
    '/api/next',
    { schema: { querystring: nextQuery } },
    async (request): Promise<NextEpisodesResponse> => next.list(request.query.series),
  );

  routes.put<{ Params: { id: number } }>(
    '/api/series/:id/next-hidden',
    { schema: { params: idParams } },
    async (request) => {
      if (!(await next.hide(request.params.id))) throw ApiError.notFound();
      return noContent();
    },
  );

  routes.delete<{ Params: { id: number } }>(
    '/api/series/:id/next-hidden',
    { schema: { params: idParams } },
    async (request) => {
      if (!(await next.unhide(request.params.id))) throw ApiError.notFound();
      return noContent();
    },
  );
}
