import type { Episode } from '@metrack/domain';
import { mapSeasonEpisode } from '../providers/tmdb/mapSeasonEpisodes.js';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import { fromProvider } from './fromProvider.js';

/** How many single episodes one request fetches for a season too large to read whole. */
export const EPISODE_CHUNK_SIZE = 15;

/**
 * Downloads a season that is too large to read whole, one chunk of single episodes per call. A chunk is the lowest
 * numbers of 1..total that are still missing, so an episode that failed is asked for again on the next call and
 * nothing already fetched is lost. The season is complete only when every number of 1..total is there.
 */
export class EpisodeChunkLoader {
  constructor(private readonly tmdb: TmdbClient) {}

  /**
   * Fetches the next chunk and merges it into `have`. Resolves to nothing when `total` is unknown or when none of
   * the requested episodes could be had.
   */
  async load(
    tmdbId: number,
    providerNumber: number,
    total: number | null,
    have: readonly Episode[],
  ): Promise<{ episodes: Episode[]; complete: boolean } | undefined> {
    if (total === null || total <= 0) return undefined;
    const known = new Set(have.map((episode) => episode.number));
    const pending: number[] = [];
    for (let n = 1; n <= total && pending.length < EPISODE_CHUNK_SIZE; n++) {
      if (!known.has(n)) pending.push(n);
    }
    if (pending.length === 0) return { episodes: [...have], complete: true };
    const results = await Promise.allSettled(
      pending.map((n) =>
        fromProvider(async () =>
          mapSeasonEpisode(await this.tmdb.seasonEpisode(tmdbId, providerNumber, n)),
        ),
      ),
    );
    const fetched = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    if (fetched.length === 0) return undefined;
    const episodes = [...have, ...fetched].sort((a, b) => a.number - b.number);
    const numbers = new Set(episodes.map((episode) => episode.number));
    let complete = true;
    for (let n = 1; n <= total; n++) complete &&= numbers.has(n);
    return { episodes, complete };
  }
}
