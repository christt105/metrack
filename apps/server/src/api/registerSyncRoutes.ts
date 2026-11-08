import type { ApiRoutes } from './ApiRoutes.js';
import { jsonResponse } from './jsonResponse.js';
import type { SyncService } from '../sync/SyncService.js';
import type { UserSyncServices } from '../sync/UserSyncServices.js';
import type { UserQueues } from '../users/UserQueues.js';
import { ApiError } from './ApiError.js';
import type { RouteRequest } from './RouteRequest.js';
import type { WebhookSecret } from './WebhookSecret.js';

const applyBody = {
  type: 'object',
  properties: { confirm: { const: true } },
  required: ['confirm'],
  additionalProperties: false,
} as const;

/**
 * Jellyfin viewing sync of the signed-in user, against the Jellyfin account in their settings. `GET /api/sync/report`
 * only computes the plan. `POST /api/sync/apply` needs `{ "confirm": true }`, recomputes the plan on the server and
 * writes it. `POST /api/sync/webhook` is the target of the Jellyfin Webhook plugin: it ignores the body, queues a
 * delayed sync for every user with a Jellyfin account and answers 202. It needs no session, since it only schedules
 * work, but when a webhook secret is set it answers 401 to a request without it. All of them answer 501 when sync is not configured, and the first two also when the user has no account set.
 */
export function registerSyncRoutes(
  routes: ApiRoutes,
  sync: UserSyncServices | undefined,
  queues?: UserQueues,
  webhookSecret?: WebhookSecret,
): void {
  const ready = (): UserSyncServices => {
    if (!sync) {
      throw ApiError.notImplemented(
        'sync_not_configured',
        'Jellyfin sync needs JELLYFIN_URL, JELLYFIN_TOKEN, JELLYSTAT_DB_HOST and JELLYSTAT_DB_PASSWORD',
      );
    }
    return sync;
  };
  const forRequest = async (request: RouteRequest): Promise<SyncService> => {
    const service = request.user ? await ready().forUser(request.user.id) : undefined;
    if (!service) {
      throw ApiError.notImplemented('sync_not_configured', 'No Jellyfin user is set for you');
    }
    return service;
  };

  routes.get('/api/sync/report', async (request) => (await forRequest(request)).report());

  routes.post('/api/sync/apply', { schema: { body: applyBody } }, async (request) =>
    (await forRequest(request)).apply(),
  );

  routes.post('/api/sync/webhook', { config: { public: true } }, async (request) => {
    if (webhookSecret && !webhookSecret.matches(request.headers, request.url)) {
      return jsonResponse(
        { error: 'Missing or wrong webhook secret', code: 'bad_webhook_secret' },
        401,
      );
    }
    ready();
    const users = (await queues?.markAllDirty()) ?? 0;
    return jsonResponse({ status: 'queued', users }, 202);
  });
}
