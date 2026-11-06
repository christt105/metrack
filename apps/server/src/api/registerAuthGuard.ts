import type { FastifyInstance } from 'fastify';
import type { Authenticator } from '../auth/Authenticator.js';
import './fastifyTypes.js';

/**
 * Requires a signed-in user on every `/api` route not marked `config.public`, answering 401 otherwise.
 * The check runs on the matched route, so an unknown path stays a plain 404.
 */
export function registerAuthGuard(app: FastifyInstance, authenticator: Authenticator): void {
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
    request.user = user;
  });
}
