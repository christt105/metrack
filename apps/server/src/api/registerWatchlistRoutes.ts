import type { ApiRoutes } from './ApiRoutes.js';
import { noContent } from './noContent.js';
import type { ReleaseAlertRepository } from '../storage/repositories/ReleaseAlertRepository.js';
import type { WatchCollection, WatchlistService } from '../alerts/WatchlistService.js';

const params = {
  type: 'object',
  properties: {
    collection: { enum: ['movies', 'series'] },
    id: { type: 'integer', minimum: 1 },
  },
  required: ['collection', 'id'],
} as const;

const alertsQuery = {
  type: 'object',
  properties: { limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
} as const;

/**
 * `GET /api/watchlist` lists what is followed, `PUT` and `DELETE /api/watchlist/{movies|series}/{id}`
 * follow and unfollow, and `GET /api/alerts` lists the alerts already sent, newest first.
 */
export function registerWatchlistRoutes(
  routes: ApiRoutes,
  watchlist: WatchlistService,
  alerts: ReleaseAlertRepository,
): void {
  routes.get('/api/watchlist', async () => watchlist.list());

  routes.put<{ Params: { collection: WatchCollection; id: number } }>(
    '/api/watchlist/:collection/:id',
    { schema: { params } },
    async (request) => {
      await watchlist.setFollowed(request.params.collection, request.params.id, true);
      return noContent();
    },
  );

  routes.delete<{ Params: { collection: WatchCollection; id: number } }>(
    '/api/watchlist/:collection/:id',
    { schema: { params } },
    async (request) => {
      await watchlist.setFollowed(request.params.collection, request.params.id, false);
      return noContent();
    },
  );

  routes.get<{ Querystring: { limit: number } }>(
    '/api/alerts',
    { schema: { querystring: alertsQuery } },
    async (request) => await alerts.list(request.query.limit),
  );
}
