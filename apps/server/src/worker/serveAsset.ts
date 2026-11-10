import type { WorkerEnv } from './WorkerEnv.js';

const MISSING = JSON.stringify({ error: 'Not found', code: 'not_found' });

/**
 * Answers a `/assets/*` request from the assets binding. The binding falls back to the single-page
 * app for unknown paths, so an HTML answer means the file does not exist: that becomes a JSON 404
 * that is never cached, instead of an `index.html` a script or stylesheet tag would choke on.
 */
export async function serveAsset(request: Request, env: WorkerEnv): Promise<Response> {
  const response = env.ASSETS ? await env.ASSETS.fetch(request) : undefined;
  if (response && response.status < 400 && !isHtml(response)) return response;
  return new Response(MISSING, {
    status: 404,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function isHtml(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').toLowerCase().startsWith('text/html');
}
