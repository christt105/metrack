import type { LibraryEpisode } from './LibraryEpisode.js';
import type { LibrarySeason } from './LibrarySeason.js';
import type { OrderedEpisode } from './OrderedEpisode.js';
import type { OrderedMatch } from './OrderedMatch.js';
import type { SeriesIndex } from './SeriesIndex.js';

function byNumber<T extends { number: number | null }>(episodes: readonly T[]): T[] {
  return [...episodes].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}

function isAired(episode: OrderedEpisode, today: string): boolean {
  return episode.airDate === null || episode.airDate <= today;
}

/**
 * Guesses the TMDB episode of the library episodes by their place when the counts agree exactly. A library season
 * with as many episodes as the season of the ordering that has its number is matched episode by episode in order;
 * otherwise the library's numbered seasons as a whole are matched by absolute position if their total equals the
 * total of aired episodes of the ordering. Library episodes without a number rule a count out. Only the episodes in
 * `candidates` get matched, and never onto an episode of the ordering that is in `taken`.
 */
export function matchByPosition(
  seasons: readonly LibrarySeason[],
  candidates: ReadonlySet<LibraryEpisode>,
  taken: ReadonlySet<number>,
  index: SeriesIndex,
  today: string,
): OrderedMatch[] {
  const result: OrderedMatch[] = [];
  const claimed = new Set(taken);
  const claim = (library: LibrarySeason, episode: LibraryEpisode, ordered: OrderedEpisode) => {
    if (!candidates.has(episode) || claimed.has(ordered.tmdbId)) return;
    claimed.add(ordered.tmdbId);
    result.push({ library, episode, ordered });
  };
  const numbered = seasons.filter((s) => s.number > 0);
  const pending = new Set<LibrarySeason>();
  for (const library of numbered) {
    if (!library.episodes.some((episode) => candidates.has(episode))) continue;
    const own = byNumber(index.episodes.filter((e) => e.seasonNumber === library.number));
    if (
      own.length > 0 &&
      own.length === library.episodes.length &&
      library.episodes.every((episode) => episode.number !== null)
    ) {
      byNumber(library.episodes).forEach((episode, i) => claim(library, episode, own[i]!));
    } else {
      pending.add(library);
    }
  }
  if (pending.size === 0) return result;
  const all = [...numbered]
    .sort((a, b) => a.number - b.number)
    .flatMap((library) => byNumber(library.episodes).map((episode) => ({ library, episode })));
  const aired = index.episodes
    .filter((e) => isAired(e, today))
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.number - b.number);
  if (
    aired.length === 0 ||
    aired.length !== all.length ||
    all.some(({ episode }) => episode.number === null)
  ) {
    return result;
  }
  all.forEach(({ library, episode }, i) => {
    if (pending.has(library)) claim(library, episode, aired[i]!);
  });
  return result;
}
