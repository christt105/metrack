import type { LibraryEpisode } from './LibraryEpisode.js';
import type { LibrarySeason } from './LibrarySeason.js';
import { matchByPosition } from './matchByPosition.js';
import type { OrderedEpisode } from './OrderedEpisode.js';
import type { OrderedMatches } from './OrderedMatches.js';
import type { SeriesIndex } from './SeriesIndex.js';

/**
 * Finds the TMDB episode of the series' ordering each watched episode of the library is. The TMDB id Jellyfin gives
 * the episode comes first when the ordering has it; no request is needed for those. Then the TheTVDB id of the
 * episode, then its air date, only when exactly one episode of the ordering aired that day. An episode whose
 * TheTVDB id TMDB knows but the ordering lacks skips the air date. An episode whose TheTVDB id TMDB places in
 * another series is never matched. What is left is matched by position when the counts agree, see `matchByPosition`,
 * never onto an episode another one matched by id.
 */
export function matchOrderedEpisodes(
  seasons: readonly LibrarySeason[],
  watched: (episode: LibraryEpisode) => boolean,
  index: SeriesIndex,
  today = '9999-12-31',
): OrderedMatches {
  const byId = new Map(index.episodes.map((episode) => [episode.tmdbId, episode]));
  const byDate = new Map<string, OrderedEpisode[]>();
  for (const episode of index.episodes) {
    if (episode.airDate === null) continue;
    byDate.set(episode.airDate, [...(byDate.get(episode.airDate) ?? []), episode]);
  }
  const result: OrderedMatches = { matches: [], unmatched: [], foreign: new Map() };
  const pending: { library: LibrarySeason; episode: LibraryEpisode }[] = [];
  for (const library of seasons) {
    for (const episode of library.episodes) {
      if (!watched(episode)) continue;
      const own = episode.tmdbId == null ? undefined : byId.get(episode.tmdbId);
      if (own !== undefined) {
        result.matches.push({ library, episode, ordered: own });
        continue;
      }
      const tvdb = episode.tvdbId ?? null;
      const other = tvdb === null ? undefined : index.foreignEpisodes[String(tvdb)];
      if (other !== undefined) {
        const known = result.foreign.get(other.showId) ?? {
          showName: other.showName,
          episodes: [],
        };
        known.episodes.push({ library, episode });
        result.foreign.set(other.showId, known);
        continue;
      }
      const tmdbId = tvdb === null ? undefined : index.episodeIds[String(tvdb)];
      let ordered = tmdbId === undefined ? undefined : byId.get(tmdbId);
      if (tmdbId === undefined && episode.airDate !== null) {
        const sameDay = byDate.get(episode.airDate) ?? [];
        if (sameDay.length === 1) ordered = sameDay[0];
      }
      if (ordered === undefined) pending.push({ library, episode });
      else result.matches.push({ library, episode, ordered });
    }
  }
  const guessed = matchByPosition(
    seasons,
    new Set(pending.map((p) => p.episode)),
    new Set(result.matches.map((m) => m.ordered.tmdbId)),
    index,
    today,
  );
  const guessedEpisodes = new Set(guessed.map((m) => m.episode));
  result.matches.push(...guessed);
  result.unmatched = pending.filter((p) => !guessedEpisodes.has(p.episode));
  return result;
}
