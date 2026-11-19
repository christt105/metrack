import type { Hono } from 'hono';
import type { ApiEnv } from './ApiEnv.js';
import { isSecureRequest, withSecurityHeaders } from './securityHeaders.js';

/**
 * Adds the security headers to every response, errors and 404s included. Register it before the routes
 * so it wraps them all.
 */
export function registerSecurityHeaders(app: Hono<ApiEnv>): void {
  app.use('*', async (context, next) => {
    await next();
    context.res = withSecurityHeaders(context.res, isSecureRequest(context.req.raw));
  });
}
