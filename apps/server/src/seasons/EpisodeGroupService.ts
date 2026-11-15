import { pickSeasonsGroup, type EpisodeGroupOptions, type Series } from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import type { MetadataCache } from '../metadata/MetadataCache.js';
import { mapGroupSeasons } from '../providers/tmdb/mapGroupSeasons.js';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { SeasonRepository } from '../storage/repositories/SeasonRepository.js';
import type { SeriesRepository } from '../storage/repositories/SeriesRepository.js';
import type { UpdateOptions } from '../storage/repositories/UpdateOptions.js';
import { loadSeasonsGroups } from './loadSeasonsGroups.js';

/** Lists the season orderings TMDB offers for a series and switches the series to one of them. */
export class EpisodeGroupService {
  constructor(
    private readonly client: TmdbClient,
    private readonly series: SeriesRepository,
    private readonly seasons: SeasonRepository,
    private readonly cache: MetadataCache,
  ) {}

  async options(seriesId: number): Promise<EpisodeGroupOptions> {
    const series = await this.require(seriesId);
    const list = await this.client.episodeGroups(series.tmdbId as number);
    return {
      current: series.tmdbEpisodeGroup,
      groups: (list.results ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        groupCount: g.group_count ?? 0,
        episodeCount: g.episode_count ?? 0,
      })),
      suggested: series.tmdbEpisodeGroup === null ? await this.suggest(series) : null,
    };
  }

  /**
   * Makes the series number its seasons by the group, or by the regular TMDB seasons for null, and relinks its
   * seasons. Refused when other users have the series, unless `allowSharedCatalog` is set.
   */
  async apply(
    seriesId: number,
    episodeGroup: string | null,
    options: UpdateOptions = {},
  ): Promise<void> {
    const series = await this.require(seriesId);
    if (series.tmdbEpisodeGroup === episodeGroup) return;
    if (episodeGroup !== null) {
      const list = await this.client.episodeGroups(series.tmdbId as number);
      if (!(list.results ?? []).some((g) => g.id === episodeGroup)) {
        throw ApiError.badRequest(
          'unknown_episode_group',
          'TMDB has no such episode group for this series',
        );
      }
    }
    await this.series.update(seriesId, { tmdbEpisodeGroup: episodeGroup }, options);
    await this.seasons.unlinkProviderSeasons(seriesId);
    await this.cache.refresh('series', seriesId, true);
  }

  private async suggest(series: Series): Promise<string | null> {
    const unknown = (await this.seasons.listBySeries(series.id))
      .filter((s) => s.number >= 1 && s.tmdbSeasonNumber === null)
      .map((s) => s.number);
    if (unknown.length === 0) return null;
    const groups = await loadSeasonsGroups(this.client, series.tmdbId as number);
    return pickSeasonsGroup(
      groups.map((g) => ({ id: g.id, seasonNumbers: mapGroupSeasons(g).map((s) => s.number) })),
      unknown,
    );
  }

  private async require(seriesId: number): Promise<Series> {
    const series = await this.series.get(seriesId);
    if (!series) throw ApiError.notFound();
    if (series.tmdbId === null) {
      throw ApiError.badRequest('no_tmdb_id', 'The series is not linked to TMDB');
    }
    return series;
  }
}
