import { isLinkedImageUrl } from '@metrack/domain';

const COPIED_PROVIDER_HOSTS = ['covers.openlibrary.org', 'artworks.thetvdb.com', 'steamgriddb.com'];

/**
 * Whether an image comes from a provider (linked or copied), so it belongs to no user and counts for no
 * quota. SteamGridDB, TheTVDB and Open Library art is copied; TMDB, Steam and IGDB art is linked.
 */
export function isProviderImageUrl(url: string | null): boolean {
  if (url === null) return false;
  if (isLinkedImageUrl(url)) return true;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      COPIED_PROVIDER_HOSTS.some(
        (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}
