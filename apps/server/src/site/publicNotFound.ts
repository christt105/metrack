import type { Language } from '@metrack/domain';
import { messagesFor, renderNotFound } from '@metrack/site';
import { publicResponse } from './publicResponse.js';

/**
 * The one answer for every public address that leads nowhere: a missing user, a page that is off or a missing item.
 * It reveals nothing about the address, so it is written in the visitor's language.
 */
export function publicNotFound(language: Language): Response {
  return publicResponse(
    renderNotFound(messagesFor(language)),
    'text/html; charset=utf-8',
    undefined,
    404,
    undefined,
    true,
  );
}
