import type { ApiRoutes } from './ApiRoutes.js';
import { jsonResponse } from './jsonResponse.js';
import type { UserQueues } from '../users/UserQueues.js';
import { ApiError } from './ApiError.js';

/** Lets a user ask for their own site to be published. The queue decides whether anything actually needs deploying. */
export function registerPublishRoutes(routes: ApiRoutes, queues: UserQueues): void {
  routes.post('/api/publish', async (request) => {
    const userId = request.user?.id;
    if (userId === undefined || !(await queues.markDirty(userId))) {
      throw ApiError.notImplemented(
        'publish_not_configured',
        'No Cloudflare Pages project is set for you',
      );
    }
    return jsonResponse({ status: 'queued', failures: queues.failureCount(userId) }, 202);
  });
}
