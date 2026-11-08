import type { Hono } from 'hono';
import type { Logger } from '../notify/Logger.js';
import type { ApiEnv } from './ApiEnv.js';

/** Runs the work after every write under `/api` that succeeded. Register it before the routes. */
export function onSuccessfulApiWrite(
  app: Hono<ApiEnv>,
  work: () => Promise<unknown>,
  logger?: Logger,
): void {
  app.use('/api/*', async (context, next) => {
    await next();
    const method = context.req.method;
    if (method === 'GET' || method === 'HEAD' || context.res.status >= 400) return;
    try {
      await work();
    } catch (error) {
      logger?.error(`Refreshing after ${method} ${context.req.path} failed: ${String(error)}`);
    }
  });
}
