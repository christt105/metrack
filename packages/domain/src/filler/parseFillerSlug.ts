const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOSTS = new Set(['animefillerlist.com', 'www.animefillerlist.com']);

/**
 * The AnimeFillerList show slug in `input`, which is either the slug itself or the address of a page under
 * `animefillerlist.com/shows/`. Any other host or shape gives null.
 */
export function parseFillerSlug(input: string): string | null {
  const text = input.trim().toLowerCase();
  if (SLUG.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!HOSTS.has(url.hostname) || url.username !== '' || url.password !== '') return null;
  const [first, slug] = url.pathname.split('/').filter((part) => part !== '');
  return first === 'shows' && slug !== undefined && SLUG.test(slug) ? slug : null;
}
