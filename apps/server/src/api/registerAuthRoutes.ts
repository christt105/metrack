import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { DevLoginRequest } from '@metrack/domain';
import { readCookie } from '../auth/readCookie.js';
import { clearedSessionCookie, SESSION_COOKIE, sessionCookie } from '../auth/sessionCookie.js';
import { ApiError } from './ApiError.js';
import type { AuthRouteDeps } from './AuthRouteDeps.js';
import './fastifyTypes.js';

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
export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  app.get('/api/auth/me', async (request) => request.user);

  app.post('/api/auth/logout', { config: { public: true } }, async (request, reply) => {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (token !== undefined) await deps.sessions.end(token);
    return reply
      .header('set-cookie', clearedSessionCookie(isHttps(request)))
      .code(204)
      .send();
  });

  if (!deps.devLogin) return;

  app.get('/api/auth/dev-users', { config: { public: true } }, async () => deps.users.list());

  app.post<{ Body: DevLoginRequest }>(
    '/api/auth/dev-login',
    { config: { public: true }, schema: { body: devLoginBody } },
    async (request, reply) => {
      const user = await deps.users.get(request.body.userId);
      if (!user) throw ApiError.notFound('That user does not exist');
      const { token, expiresAt } = await deps.sessions.start(user.id);
      return reply
        .header('set-cookie', sessionCookie(token, expiresAt, isHttps(request)))
        .send(user);
    },
  );
}

function isHttps(request: FastifyRequest): boolean {
  return request.protocol === 'https';
}
