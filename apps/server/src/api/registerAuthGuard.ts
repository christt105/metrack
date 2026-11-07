import type { FastifyInstance } from 'fastify';
import type { Authenticator } from '../auth/Authenticator.js';
import { OWNER_ID } from '../users/OWNER_ID.js';
import type { UserScope } from '../users/UserScope.js';
import './fastifyTypes.js';

/**
 * Requires a signed-in user on every `/api` route not marked `config.public`, answering 401 otherwise,
 * and runs the rest of the request as that user, so repositories only see their data. Routes marked
 * `config.ownerOnly` act on the whole instance and answer 403 to anyone but the owner. The check runs
 * on the matched route, so an unknown path stays a plain 404.
 */
export function registerAuthGuard(
  app: FastifyInstance,
  authenticator: Authenticator,
  scope: UserScope,
): void {
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request, reply) => {
    const route = request.routeOptions.url;
    if (route === undefined || !route.startsWith('/api/') || request.routeOptions.config.public) {
      return;
    }
    const user = await authenticator.userFor(request.headers);
    if (!user) {
      return reply.code(401).send({ error: 'Sign in first', code: 'unauthenticated' });
    }
    if (request.routeOptions.config.ownerOnly && user.id !== OWNER_ID) {
      return reply.code(403).send({ error: 'Only the owner can do this', code: 'owner_only' });
    }
    request.user = user;
  });
  app.addHook('onRequest', (request, _reply, done) => {
    if (request.user) scope.run(request.user.id, done);
    else done();
  });
}
