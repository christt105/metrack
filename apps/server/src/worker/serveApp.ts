import { withSecurityHeaders } from '../api/securityHeaders.js';
import type { WorkerEnv } from './WorkerEnv.js';

/**
 * Answers a request that is neither API nor public page from the assets binding, which falls back to the
 * single-page app. The security headers go on here so the HTML gets a policy with its own nonce.
 */
export async function serveApp(request: Request, env: WorkerEnv): Promise<Response> {
  const path = new URL(request.url).pathname;
  const response = env.ASSETS
    ? await env.ASSETS.fetch(request)
    : new Response('Not found', { status: 404 });
  return withSecurityHeaders(response, true, path);
}
