import type { Episode } from './Episode.js';
import type { EpisodeCatalogMatch } from './EpisodeCatalogMatch.js';

/**
 * Decides whether a catalog may stand for a season. Without a stored count it always does. Otherwise the episodes
 * that have aired (no air date, or one up to `today`, an ISO date) must be as many as the stored count, so a
 * catalog that is longer only by episodes still to air fits, and one that numbers the season differently does not.
 */
export function matchEpisodeCatalog(
  storedCount: number | null,
  episodes: readonly Episode[],
  today: string,
): EpisodeCatalogMatch {
  if (storedCount === null) return { applies: true, mismatch: null };
  const aired = episodes.filter((e) => e.airDate === null || e.airDate <= today).length;
  if (aired === storedCount) return { applies: true, mismatch: null };
  return { applies: false, mismatch: { catalogEpisodes: episodes.length } };
}
