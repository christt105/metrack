import type { Hono } from 'hono';
import type { ContentVersions } from '../site/ContentVersions.js';
import type { Logger } from '../notify/Logger.js';
import type { ApiEnv } from './ApiEnv.js';

/**
 * Bumps the content version of the signed-in user after every write under `/api` that succeeded. It runs after
 * the write so a page rendered meanwhile is stored under the old version and is discarded by the next visit.
 * Register it after the auth guard.
 */
export function bumpContentVersionOnWrite(
  app: Hono<ApiEnv>,
  versions: ContentVersions,
  logger?: Logger,
): void {
  app.use('/api/*', async (context, next) => {
    await next();
    const method = context.req.method;
    const user = context.get('user');
    if (!user || method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
    if (context.res.status >= 400) return;
    try {
      await versions.bump(user.id);
    } catch (error) {
      logger?.error(
        `Bumping the content version after ${method} ${context.req.path} failed: ${String(error)}`,
      );
    }
  });
}
