const LINKED_HOSTS = ['image.tmdb.org', 'images.igdb.com', 'steamcdn-a.akamaihd.net'];
const LINKED_SUFFIXES = ['.steamstatic.com'];

/**
 * Whether a cover or banner URL is stored as a link to the provider's CDN instead of a copy: TMDB, Steam and
 * IGDB serve their images for anyone to show and can hand them out again by id.
 */
export function isLinkedImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname;
  return LINKED_HOSTS.includes(host) || LINKED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
