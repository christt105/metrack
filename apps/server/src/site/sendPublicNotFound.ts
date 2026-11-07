import type { FastifyReply } from 'fastify';
import { renderNotFound } from '@metrack/site';

/** The one answer for every public address that leads nowhere: a missing user, a page that is off or a missing item. */
export function sendPublicNotFound(reply: FastifyReply): FastifyReply {
  return reply
    .code(404)
    .header('X-Robots-Tag', 'noindex')
    .type('text/html; charset=utf-8')
    .send(renderNotFound());
}
