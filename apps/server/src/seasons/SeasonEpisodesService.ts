import {
  countWatchedEpisodes,
  isEpisodeCatalogStale,
  isSeasonAiring,
  numberedEpisodes,
  remapEpisodeWatches,
  type Episode,
  type EpisodeWatches,
  type Season,
  type SeasonEpisodes,
  type Series,
} from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import { mapGroupSeasonEpisodes, mapSeasonEpisodes } from '../providers/tmdb/mapSeasonEpisodes.js';
import type { SeasonEpisodesDeps } from './SeasonEpisodesDeps.js';
import type { SeasonEpisodesResult } from './SeasonEpisodesResult.js';

/**
 * The episodes of a season and what the user in scope watched of them. The shared catalog is read from its one
 * row and, when it is missing or stale and the series has a TMDB id, fetched again with a single TMDB request and
 * stored. Without a catalog the answer lists bare episode numbers and stores nothing, so the next visit tries
 * again. A refresh that renumbers the episodes moves every user's watches of the season by TMDB id.
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
    const stored = await this.deps.catalog.get(seasonId);
    let catalog = stored;
    let episodeCountChanged = false;
    if (series && series.tmdbId !== null && this.isStale(season, series, stored)) {
      const fetched = await this.fetch(season, series);
      if (fetched) {
        catalog = fetched;
        await this.deps.catalog.put(fetched);
        if (fetched.episodes.length !== season.episodeCount) {
          await this.deps.seasons.updateCatalog(seasonId, {
            episodeCount: fetched.episodes.length,
          });
          episodeCountChanged = true;
        }
        if (stored) await this.remapUsers(seasonId, stored.episodes, fetched.episodes);
      }
    }
    const episodes = catalog?.episodes ?? numberedEpisodes(season.episodeCount);
    const watched = await this.deps.watches.get(seasonId);
    return {
      response: this.respond(season, catalog, episodes, watched),
      episodeCountChanged,
    };
  }

  private isStale(season: Season, series: Series, stored: SeasonEpisodes | undefined): boolean {
    if (!stored) return true;
    const airing = isSeasonAiring(
      series.nextEpisode,
      season.tmdbSeasonNumber ?? season.number,
      stored.episodes,
      this.now(),
    );
    return isEpisodeCatalogStale(stored.fetchedAt, this.now(), airing);
  }

  private async fetch(season: Season, series: Series): Promise<SeasonEpisodes | undefined> {
    const { tmdb } = this.deps;
    if (!tmdb || series.tmdbId === null) return undefined;
    const seasonNumber = season.tmdbSeasonNumber ?? season.number;
    try {
      const episodes =
        series.tmdbEpisodeGroup !== null
          ? mapGroupSeasonEpisodes(await tmdb.episodeGroup(series.tmdbEpisodeGroup), seasonNumber)
          : mapSeasonEpisodes(await tmdb.season(series.tmdbId, seasonNumber));
      if (!episodes || episodes.length === 0) return undefined;
      return {
        seasonId: season.id,
        episodes,
        source: 'tmdb',
        fetchedAt: this.now().toISOString(),
      };
    } catch {
      return undefined;
    }
  }

  private async remapUsers(
    seasonId: number,
    before: readonly Episode[],
    after: readonly Episode[],
  ): Promise<void> {
    if (!renumbered(before, after)) return;
    for (const row of await this.deps.watches.listForSeason(seasonId)) {
      const moved = remapEpisodeWatches(before, after, row.watched);
      if (JSON.stringify(moved) !== JSON.stringify(row.watched)) {
        await this.deps.watches.replace(row.userId, seasonId, moved);
      }
    }
  }

  private respond(
    season: Season,
    catalog: SeasonEpisodes | undefined,
    episodes: readonly Episode[],
    stored: EpisodeWatches | undefined,
  ): SeasonEpisodesResult['response'] {
    const allWatched = stored === undefined && season.status === 'completed';
    const watched = stored ?? {};
    return {
      seasonId: season.id,
      source: catalog?.source ?? 'numbers',
      fetchedAt: catalog?.fetchedAt ?? null,
      episodeCount: episodes.length,
      watchedCount: allWatched ? episodes.length : countWatchedEpisodes(watched),
      episodes: episodes.map((episode) => {
        const viewings = watched[String(episode.number)];
        return {
          number: episode.number,
          title: episode.title,
          airDate: episode.airDate,
          runtime: episode.runtime,
          overview: episode.overview,
          watched: allWatched || viewings !== undefined,
          viewings: viewings ?? [],
        };
      }),
    };
  }
}

function renumbered(before: readonly Episode[], after: readonly Episode[]): boolean {
  const numberOf = new Map(after.flatMap((e) => (e.tmdbId === null ? [] : [[e.tmdbId, e.number]])));
  return before.some(
    (e) => e.tmdbId !== null && numberOf.get(e.tmdbId) !== e.number && numberOf.has(e.tmdbId),
  );
}
