import type { User } from '@metrack/domain';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Answers without a session. Every other `/api` route needs one. */
    public?: boolean;
  }
  interface FastifyRequest {
    /** Who made the request; set by the auth guard on every route that is not public. */
    user: User | null;
  }
}
