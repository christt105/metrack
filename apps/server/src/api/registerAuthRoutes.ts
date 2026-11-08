import type { ApiRoutes } from './ApiRoutes.js';
import { jsonResponse } from './jsonResponse.js';
import type { RouteRequest } from './RouteRequest.js';
import type { DevLoginRequest } from '@metrack/domain';
import { readCookie } from '../auth/readCookie.js';
import { clearedSessionCookie, SESSION_COOKIE, sessionCookie } from '../auth/sessionCookie.js';
import { ApiError } from './ApiError.js';
import type { AuthRouteDeps } from './AuthRouteDeps.js';

const devLoginBody = {
  type: 'object',
  properties: { userId: { type: 'integer', minimum: 1 } },
  required: ['userId'],
  additionalProperties: false,
} as const;

/**
 * `GET /api/auth/me` answers the signed-in user and `POST /api/auth/logout` ends the session. With dev
 * login on, `GET /api/auth/dev-users` lists who can sign in and `POST /api/auth/dev-login` signs in as
 * any of them; with it off, both routes do not exist.
 */
export function registerAuthRoutes(routes: ApiRoutes, deps: AuthRouteDeps): void {
  routes.get('/api/auth/me', async (request) => request.user);

  routes.post('/api/auth/logout', { config: { public: true } }, async (request) => {
    const token = readCookie(request.headers.get('cookie') ?? undefined, SESSION_COOKIE);
    if (token !== undefined) await deps.sessions.end(token);
    return new Response(null, {
      status: 204,
      headers: { 'set-cookie': clearedSessionCookie(isHttps(request)) },
    });
  });

  if (!deps.devLogin) return;

  routes.get('/api/auth/dev-users', { config: { public: true } }, async () => deps.users.list());

  routes.post<{ Body: DevLoginRequest }>(
    '/api/auth/dev-login',
    { config: { public: true }, schema: { body: devLoginBody } },
    async (request) => {
      const user = await deps.users.get(request.body.userId);
      if (!user) throw ApiError.notFound('That user does not exist');
      const { token, expiresAt } = await deps.sessions.start(user.id);
      const response = jsonResponse(user);
      response.headers.set('set-cookie', sessionCookie(token, expiresAt, isHttps(request)));
      return response;
    },
  );
}

function isHttps(request: RouteRequest): boolean {
  return request.url.protocol === 'https:';
}
