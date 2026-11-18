import type { LibraryEpisode } from './LibraryEpisode.js';
import type { LibrarySeason } from './LibrarySeason.js';
import type { OrderedEpisode } from './OrderedEpisode.js';
import type { SeriesIndex } from './SeriesIndex.js';

export interface OrderedMatch {
  library: LibrarySeason;
  episode: LibraryEpisode;
  ordered: OrderedEpisode;
}

export interface OrderedMatches {
  matches: OrderedMatch[];
  /** Watched episodes no TMDB episode of the ordering could be found for. */
  unmatched: number;
}

/**
 * Finds the TMDB episode of the series' ordering each watched episode of the library is. The TheTVDB id of the
 * episode comes first. An episode without one, or whose id TMDB does not know, is matched by its air date, only
 * when exactly one episode of the ordering aired that day. An episode whose id TMDB knows but the ordering lacks
 * is not matched.
 */
export function matchOrderedEpisodes(
  seasons: readonly LibrarySeason[],
  watched: (episode: LibraryEpisode) => boolean,
  index: SeriesIndex,
): OrderedMatches {
  const byId = new Map(index.episodes.map((episode) => [episode.tmdbId, episode]));
  const byDate = new Map<string, OrderedEpisode[]>();
  for (const episode of index.episodes) {
    if (episode.airDate === null) continue;
    byDate.set(episode.airDate, [...(byDate.get(episode.airDate) ?? []), episode]);
  }
  const result: OrderedMatches = { matches: [], unmatched: 0 };
  for (const library of seasons) {
    for (const episode of library.episodes) {
      if (!watched(episode)) continue;
      const tmdbId =
        episode.tvdbId === null || episode.tvdbId === undefined
          ? undefined
          : index.episodeIds[String(episode.tvdbId)];
      let ordered = tmdbId === undefined ? undefined : byId.get(tmdbId);
      if (tmdbId === undefined && episode.airDate !== null) {
        const sameDay = byDate.get(episode.airDate) ?? [];
        if (sameDay.length === 1) ordered = sameDay[0];
      }
      if (ordered === undefined) result.unmatched += 1;
      else result.matches.push({ library, episode, ordered });
    }
  }
  return result;
}
