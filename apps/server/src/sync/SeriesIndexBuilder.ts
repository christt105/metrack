import {
  collectSyncWatchDays,
  findStoredSeries,
  type LibraryEpisode,
  type SeriesIndex,
  type SyncInput,
} from '@metrack/domain';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import { loadSeriesOrdering } from './loadSeriesOrdering.js';
import type { TvdbEpisodeIdCache } from './TvdbEpisodeIdCache.js';

const LOOKUP_BATCH = 10;

type Input = Pick<SyncInput, 'movies' | 'series' | 'plays' | 'timeZone' | 'state' | 'today'>;

/**
 * Builds, for each watched series linked to TMDB, what the planner needs to record its viewings by TMDB episode id:
 * the TMDB id of each watched episode TheTVDB knows (asked of TMDB's `/find` once and remembered, see
 * `TvdbEpisodeIdCache`) and the series' ordering. It runs where the sync runs, which has a TMDB key and no CPU
 * limit. A series whose ordering cannot be read gets no index, so it falls back to the library's numbering.
 */
export class SeriesIndexBuilder {
  constructor(
    private readonly tmdb: TmdbClient,
    private readonly cache: TvdbEpisodeIdCache,
  ) {}

  async build(input: Input): Promise<Map<string, SeriesIndex>> {
    const { days } = collectSyncWatchDays(input);
    const indexes = new Map<string, SeriesIndex>();
    for (const item of input.series) {
      const watched = item.seasons
        .filter((season) => season.number > 0)
        .flatMap((season) => season.episodes.filter((episode) => days.has(episode.jellyfinId)));
      if (watched.length === 0) continue;
      const stored = findStoredSeries(input.state, item);
      const tmdbId = stored?.tmdbId ?? item.tmdbId;
      if (tmdbId === null) continue;
      try {
        const ordering = await loadSeriesOrdering(
          this.tmdb,
          tmdbId,
          stored?.tmdbEpisodeGroup ?? null,
        );
        const episodeIds = await this.episodeIds(watched, input.today);
        indexes.set(item.jellyfinId, { episodeIds, ...ordering });
      } catch {
        continue;
      }
    }
    this.cache.flush();
    return indexes;
  }

  private async episodeIds(
    episodes: readonly LibraryEpisode[],
    today: string,
  ): Promise<Record<string, number>> {
    const ids: Record<string, number> = {};
    const toAsk: number[] = [];
    for (const { tvdbId } of episodes) {
      if (tvdbId === null || tvdbId === undefined) continue;
      const known = this.cache.lookup(tvdbId, today);
      if (known === undefined) toAsk.push(tvdbId);
      else if (known !== null) ids[String(tvdbId)] = known;
    }
    for (let from = 0; from < toAsk.length; from += LOOKUP_BATCH) {
      const batch = toAsk.slice(from, from + LOOKUP_BATCH);
      const found = await Promise.all(
        batch.map((tvdbId) =>
          this.tmdb.episodeIdForTvdb(tvdbId).then(
            (tmdbId) => ({ tvdbId, tmdbId, failed: false }),
            () => ({ tvdbId, tmdbId: null, failed: true }),
          ),
        ),
      );
      for (const { tvdbId, tmdbId, failed } of found) {
        if (failed) continue;
        this.cache.record(tvdbId, tmdbId, today);
        if (tmdbId !== null) ids[String(tvdbId)] = tmdbId;
      }
    }
    return ids;
  }
}
