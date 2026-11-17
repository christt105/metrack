import type { MediaQuery } from '@metrack/domain';
import type { GlobalContentVersion } from '../site/GlobalContentVersion.js';

const DEFAULT_LIMIT = 50;

/**
 * The strong validator of one user's library list: who asks, the content versions of every user and the list
 * query with its defaults applied, so the order of the parameters does not matter. It is computed before the
 * list is read, so a write that lands meanwhile can only make the next request fetch again.
 */
export async function mediaListEtag(
  userId: number,
  global: GlobalContentVersion,
  query: MediaQuery,
): Promise<string> {
  const sort = query.sort ?? 'title';
  const normalized = [
    userId,
    global.total,
    global.users,
    query.type ?? null,
    query.status ?? null,
    query.q?.trim() || null,
    sort,
    query.order ?? (sort === 'recent' ? 'desc' : 'asc'),
    query.limit ?? DEFAULT_LIMIT,
    query.offset ?? 0,
  ];
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(normalized)),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'));
  return `"${hex.join('')}"`;
}
