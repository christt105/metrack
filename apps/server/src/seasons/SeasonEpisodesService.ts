import {
  countWatchedEpisodes,
  episodeKey,
  idEpisodeWatches,
  isEpisodeCatalogStale,
  isSeasonAiring,
  numberedEpisodes,
  type Episode,
  type EpisodeWatches,
  type Season,
  type SeasonEpisodes,
  type Series,
} from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import { ResponseTooLargeError } from '../http/ResponseTooLargeError.js';
import {
  mapGroupSeasonEpisodes,
  mapSeasonEpisode,
  mapSeasonEpisodes,
} from '../providers/tmdb/mapSeasonEpisodes.js';
import type { SeasonEpisodesDeps } from './SeasonEpisodesDeps.js';
import type { SeasonEpisodesResult } from './SeasonEpisodesResult.js';

/** How many single episodes one request fetches for a season too large to read whole. */
export const EPISODE_CHUNK_SIZE = 15;

/**
 * The episodes of a season and what the user in scope watched of them. The shared catalog is read from its one
 * row and, when it is missing, stale or still being filled in, and the series has a TMDB id, fetched from TMDB
 * following the series' ordering: one request for the season of its episode group, one for a regular season, or,
 * when a regular season is over 1 MB, a chunk of single episodes per call until it is complete. A complete
 * catalog sets the season's episode count. Without a catalog the answer lists bare episode numbers and stores
 * nothing, so the next visit tries again. When the catalog has TMDB ids, the user's watches of the season that
 * were stored under numbering keys move to the ids.
 */
export class SeasonEpisodesService {
  private readonly now: () => Date;

  constructor(private readonly deps: SeasonEpisodesDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async get(seasonId: number): Promise<SeasonEpisodesResult> {
    const season = await this.deps.seasons.get(seasonId);
    if (!season) throw ApiError.notFound();
    const series = await this.deps.series.get(season.seriesId);
    let catalog = await this.deps.catalog.get(seasonId);
    let episodeCountChanged = false;
    if (series && series.tmdbId !== null && this.needsFetch(season, series, catalog)) {
      const fetched = await this.fetch(season, series, catalog);
      if (fetched) {
        catalog = fetched;
        await this.deps.catalog.put(fetched);
        if (fetched.complete && season.episodeCount !== fetched.episodes.length) {
          await this.deps.seasons.updateCatalog(seasonId, {
            episodeCount: fetched.episodes.length,
          });
          episodeCountChanged = true;
        }
      }
    }
    const episodes =
      catalog && catalog.episodes.length > 0
        ? catalog.episodes
        : numberedEpisodes(season.episodeCount);
    const stored = await this.deps.watches.get(season.seriesId);
    const watched = await this.withIds(season, catalog, episodes, stored);
    return {
      response: this.respond(season, catalog, episodes, watched),
      episodeCountChanged,
    };
  }

  private needsFetch(season: Season, series: Series, stored: SeasonEpisodes | undefined): boolean {
    if (!stored || !stored.complete) return true;
    const airing = isSeasonAiring(
      series.nextEpisode,
      season.tmdbSeasonNumber ?? season.number,
      stored.episodes,
      this.now(),
    );
    return isEpisodeCatalogStale(stored.fetchedAt, this.now(), airing);
  }

  private async fetch(
    season: Season,
    series: Series,
    stored: SeasonEpisodes | undefined,
  ): Promise<SeasonEpisodes | undefined> {
    const { tmdb } = this.deps;
    if (!tmdb || series.tmdbId === null) return undefined;
    const providerNumber = season.tmdbSeasonNumber ?? season.number;
    const catalog = (episodes: Episode[], complete: boolean): SeasonEpisodes => ({
      seasonId: season.id,
      episodes,
      source: 'tmdb',
      fetchedAt: this.now().toISOString(),
      complete,
    });
    try {
      if (series.tmdbEpisodeGroup !== null) {
        const group = await tmdb.episodeGroup(series.tmdbEpisodeGroup);
        const episodes = mapGroupSeasonEpisodes(group, providerNumber);
        return episodes && episodes.length > 0 ? catalog(episodes, true) : undefined;
      }
      const continuing = stored !== undefined && !stored.complete;
      if (!continuing) {
        try {
          const episodes = mapSeasonEpisodes(await tmdb.season(series.tmdbId, providerNumber));
          return episodes.length > 0 ? catalog(episodes, true) : undefined;
        } catch (error) {
          if (!(error instanceof ResponseTooLargeError)) throw error;
        }
      }
      const chunk = await this.fetchChunk(
        series.tmdbId,
        providerNumber,
        season.episodeCount,
        continuing ? stored.episodes : [],
      );
      return chunk ? catalog(chunk.episodes, chunk.complete) : undefined;
    } catch {
      return undefined;
    }
  }

  private async fetchChunk(
    tmdbId: number,
    providerNumber: number,
    count: number | null,
    have: readonly Episode[],
  ): Promise<{ episodes: Episode[]; complete: boolean } | undefined> {
    const { tmdb } = this.deps;
    if (!tmdb || count === null || count <= 0) return undefined;
    const from = Math.max(0, ...have.map((e) => e.number)) + 1;
    const last = Math.min(from + EPISODE_CHUNK_SIZE - 1, count);
    const numbers = Array.from({ length: Math.max(0, last - from + 1) }, (_, i) => from + i);
    const results = await Promise.allSettled(
      numbers.map((n) => tmdb.seasonEpisode(tmdbId, providerNumber, n)),
    );
    const fetched = results.flatMap((r) =>
      r.status === 'fulfilled' ? [mapSeasonEpisode(r.value)] : [],
    );
    if (fetched.length === 0) return undefined;
    const episodes = [...have, ...fetched].sort((a, b) => a.number - b.number);
    return { episodes, complete: last >= count };
  }

  private async withIds(
    season: Season,
    catalog: SeasonEpisodes | undefined,
    episodes: readonly Episode[],
    stored: EpisodeWatches | undefined,
  ): Promise<EpisodeWatches | undefined> {
    if (!stored || !catalog) return stored;
    const moved = idEpisodeWatches(episodes, season.number, stored);
    if (moved !== stored) await this.deps.watches.set(season.seriesId, moved);
    return moved;
  }

  private respond(
    season: Season,
    catalog: SeasonEpisodes | undefined,
    episodes: readonly Episode[],
    stored: EpisodeWatches | undefined,
  ): SeasonEpisodesResult['response'] {
    const watched = stored ?? {};
    const counted = countWatchedEpisodes(episodes, season.number, watched);
    const allWatched = counted === 0 && season.status === 'completed' && season.watchedCount > 0;
    return {
      seasonId: season.id,
      source: catalog?.source ?? 'numbers',
      fetchedAt: catalog?.fetchedAt ?? null,
      complete: catalog?.complete ?? true,
      episodeCount: episodes.length,
      watchedCount: allWatched ? episodes.length : counted,
      episodes: episodes.map((episode) => {
        const key = episodeKey(episode, season.number);
        const viewings = watched[key];
        return {
          key,
          number: episode.number,
          tmdbId: episode.tmdbId,
          title: episode.title,
          airDate: episode.airDate,
          runtime: episode.runtime,
          overview: episode.overview,
          stillPath: episode.stillPath,
          watched: allWatched || viewings !== undefined,
          viewings: viewings ?? [],
        };
      }),
    };
  }
}
