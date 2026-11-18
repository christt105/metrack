const STILL_BASE = 'https://image.tmdb.org/t/p/w300';

/** The TMDB image URL of an episode still, or null when the episode has none. */
export function stillUrl(stillPath: string | null): string | null {
  return stillPath && stillPath.startsWith('/') ? `${STILL_BASE}${stillPath}` : null;
}
