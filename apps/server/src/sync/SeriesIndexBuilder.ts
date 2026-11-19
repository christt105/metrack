import {
  collectSyncWatchDays,
  findStoredSeries,
  hasCollapsibleViewings,
  type ForeignEpisode,
  type LibraryEpisode,
  type SeriesIndex,
  type SyncInput,
  type Viewing,
} from '@metrack/domain';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { TmdbEpisodeMatch } from '../providers/tmdb/TmdbEpisodeMatch.js';
import type { SeriesIndexes } from './SeriesIndexes.js';
import { loadSeriesOrdering } from './loadSeriesOrdering.js';
import type { TvdbEpisodeIdCache } from './TvdbEpisodeIdCache.js';

const LOOKUP_BATCH = 10;

type Input = Pick<
  SyncInput,
  'movies' | 'series' | 'plays' | 'companionPlays' | 'timeZone' | 'state' | 'today'
>;

/**
 * Builds, for each watched series linked to TMDB, what the planner needs to record its viewings by TMDB episode id:
 * the TMDB id of each watched episode TheTVDB knows and the TMDB series it belongs to (asked of TMDB's `/find`
 * once and remembered, see `TvdbEpisodeIdCache`; an episode of another series than the one synced is reported as
 * foreign, never as an id) and the series' ordering. It runs where the sync runs, which has a TMDB key and no CPU
 * limit. A series whose watched episodes are all recorded already (every one has a cached TMDB id and a viewing
 * for each day it was played) is `settled`: it costs no TMDB request and the planner leaves it out. A series whose
 * ordering cannot be read gets no index, so it falls back to the library's numbering.
 */
export class SeriesIndexBuilder {
  constructor(
    private readonly tmdb: TmdbClient,
    private readonly cache: TvdbEpisodeIdCache,
  ) {}

  async build(input: Input): Promise<SeriesIndexes> {
    const { days } = collectSyncWatchDays(input);
    const indexes = new Map<string, SeriesIndex>();
    const settled = new Set<string>();
    for (const item of input.series) {
      const watched = item.seasons
        .filter((season) => season.number > 0)
        .flatMap((season) => season.episodes.filter((episode) => days.has(episode.jellyfinId)));
      if (watched.length === 0) continue;
      const stored = findStoredSeries(input.state, item);
      const tmdbId = stored?.tmdbId ?? item.tmdbId;
      if (tmdbId === null) continue;
      if (stored && this.isRecorded(watched, days, input, stored.id, tmdbId)) {
        settled.add(item.jellyfinId);
        continue;
      }
      try {
        const ordering = await loadSeriesOrdering(
          this.tmdb,
          tmdbId,
          stored?.tmdbEpisodeGroup ?? null,
        );
        const known = new Set(ordering.episodes.map((episode) => episode.tmdbId));
        const unknown = watched.filter(
          (episode) => episode.tmdbId == null || !known.has(episode.tmdbId),
        );
        const found = await this.episodeIds(unknown, input.today);
        const foreign = await this.foreignEpisodes(found, tmdbId);
        const episodeIds: Record<string, number> = {};
        for (const [tvdbId, match] of Object.entries(found)) {
          if (!(tvdbId in foreign.episodes)) episodeIds[tvdbId] = match.id;
        }
        indexes.set(item.jellyfinId, {
          tmdbId,
          name: foreign.ownName ?? item.title,
          foreignEpisodes: foreign.episodes,
          episodeIds,
          ...ordering,
        });
      } catch {
        continue;
      }
    }
    this.cache.flush();
    return { indexes, settled };
  }

  /** Whether every watched episode is known to TMDB by id and has a viewing on each day it was played. */
  private isRecorded(
    watched: readonly LibraryEpisode[],
    days: ReadonlyMap<string, string[]>,
    input: Input,
    seriesId: number,
    seriesTmdbId: number,
  ): boolean {
    const stored = input.state.watches?.find((row) => row.seriesId === seriesId)?.watched;
    if (!stored) return false;
    const finishes = input.state.seasons
      .filter((season) => season.seriesId === seriesId)
      .map((season) => season.finishedAt);
    if (hasCollapsibleViewings(stored, finishes)) return false;
    return watched.every((episode) => {
      const own = episode.tmdbId == null ? undefined : stored[String(episode.tmdbId)];
      if (own !== undefined && this.hasDays(own, days.get(episode.jellyfinId))) return true;
      if (episode.tvdbId === null || episode.tvdbId === undefined) return false;
      const match = this.cache.lookup(episode.tvdbId, input.today);
      if (!match || (match.showId !== null && match.showId !== seriesTmdbId)) return false;
      return this.hasDays(stored[String(match.id)], days.get(episode.jellyfinId));
    });
  }

  private hasDays(viewings: readonly Viewing[] | undefined, played: readonly string[] | undefined) {
    return (played ?? []).every((day) => viewings?.some((viewing) => viewing.finishedAt === day));
  }

  private async foreignEpisodes(
    found: Readonly<Record<string, TmdbEpisodeMatch>>,
    tmdbId: number,
  ): Promise<{ episodes: Record<string, ForeignEpisode>; ownName: string | null }> {
    const episodes: Record<string, ForeignEpisode> = {};
    const names = new Map<number, string>();
    const nameOf = async (showId: number): Promise<string> => {
      const known = names.get(showId);
      if (known !== undefined) return known;
      const name = await this.tmdb.tv(showId).then(
        (title) => title.name ?? title.title ?? `TMDB ${showId}`,
        () => `TMDB ${showId}`,
      );
      names.set(showId, name);
      return name;
    };
    for (const [tvdbId, match] of Object.entries(found)) {
      if (match.showId === null || match.showId === tmdbId) continue;
      episodes[tvdbId] = { showId: match.showId, showName: await nameOf(match.showId) };
    }
    const ownName = Object.keys(episodes).length > 0 ? await nameOf(tmdbId) : null;
    return { episodes, ownName };
  }

  private async episodeIds(
    episodes: readonly LibraryEpisode[],
    today: string,
  ): Promise<Record<string, TmdbEpisodeMatch>> {
    const ids: Record<string, TmdbEpisodeMatch> = {};
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
          this.tmdb.episodeForTvdb(tvdbId).then(
            (match) => ({ tvdbId, match, failed: false }),
            () => ({ tvdbId, match: null, failed: true }),
          ),
        ),
      );
      for (const { tvdbId, match, failed } of found) {
        if (failed) continue;
        this.cache.record(tvdbId, match, today);
        if (match !== null) ids[String(tvdbId)] = match;
      }
    }
    return ids;
  }
}
