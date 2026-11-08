import { renderNotFound } from '@metrack/site';
import { publicResponse } from './publicResponse.js';

/** The one answer for every public address that leads nowhere: a missing user, a page that is off or a missing item. */
export function publicNotFound(): Response {
  return publicResponse(renderNotFound(), 'text/html; charset=utf-8', undefined, 404);
}
