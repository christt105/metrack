import type { FastifyInstance } from 'fastify';
import type { ApiTokenService } from '../auth/ApiTokenService.js';
import type { Authenticator } from '../auth/Authenticator.js';
import { readBearerToken } from '../auth/readBearerToken.js';
import { OWNER_ID } from '../users/OWNER_ID.js';
import type { UserScope } from '../users/UserScope.js';
import './fastifyTypes.js';

const READ_METHODS = new Set(['GET', 'HEAD']);

/**
 * Requires a signed-in user on every `/api` route not marked `config.public`, answering 401 otherwise,
 * and runs the rest of the request as that user, so repositories only see their data. Routes marked
 * `config.ownerOnly` act on the whole instance and answer 403 to anyone but the owner. The check runs
 * on the matched route, so an unknown path stays a plain 404.
 *
 * A request with an `Authorization` header signs in with a personal API token instead of the
 * session cookie. Tokens never reach `ownerOnly` or `sessionOnly` routes, and a `read` token only
 * reads.
 */
export function registerAuthGuard(
  app: FastifyInstance,
  authenticator: Authenticator,
  scope: UserScope,
  tokens?: ApiTokenService,
): void {
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request, reply) => {
    const route = request.routeOptions.url;
    const config = request.routeOptions.config;
    if (route === undefined || !route.startsWith('/api/') || config.public) {
      return;
    }
    const bearer = readBearerToken(request.headers.authorization);
    if (bearer !== undefined) {
      const signIn = bearer === '' || !tokens ? undefined : await tokens.resolve(bearer);
      if (!signIn) {
        return reply.code(401).send({ error: 'Unknown or expired token', code: 'bad_token' });
      }
      if (config.ownerOnly || config.sessionOnly) {
        return reply
          .code(403)
          .send({ error: 'Sign in to the web app to do this', code: 'session_required' });
      }
      if (signIn.scope === 'read' && !READ_METHODS.has(request.method)) {
        return reply.code(403).send({ error: 'This token can only read', code: 'read_only_token' });
      }
      request.user = signIn.user;
      return;
    }
    const user = await authenticator.userFor(request.headers);
    if (!user) {
      return reply.code(401).send({ error: 'Sign in first', code: 'unauthenticated' });
    }
    if (config.ownerOnly && user.id !== OWNER_ID) {
      return reply.code(403).send({ error: 'Only the owner can do this', code: 'owner_only' });
    }
    request.user = user;
  });
  app.addHook('onRequest', (request, _reply, done) => {
    if (request.user) scope.run(request.user.id, done);
    else done();
  });
}
