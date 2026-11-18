import {
  pickSeasonsGroup,
  planSeasonRefresh,
  type SeasonRefreshPlan,
  type ProviderSeason,
  type Series,
} from '@metrack/domain';
import type { ImageStore } from '../images/ImageStore.js';
import { mapGroupSeasons } from '../providers/tmdb/mapGroupSeasons.js';
import { mapRegularSeasons } from '../providers/tmdb/mapRegularSeasons.js';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { TmdbTitleResponse } from '../providers/tmdb/TmdbTitleResponse.js';
import type { SeasonRepository } from '../storage/repositories/SeasonRepository.js';
import { emptySeason } from '../media/emptyEntities.js';
import type { SeasonEpisodesRepository } from '../storage/repositories/SeasonEpisodesRepository.js';
import { loadSeasonsGroups } from './loadSeasonsGroups.js';

/**
 * Brings the stored seasons of a series in line with TMDB: title, overview, first air date and episode count
 * follow the provider, a cover is filled in only when the season has none, and seasons without a provider
 * number are linked by the date of their first episode. A series that follows an episode group is read from
 * that group. A season that TMDB's regular seasons do not know makes the series follow the only "Seasons"
 * group that has it, which is returned so the caller records it. Provider failures leave the seasons as they were.
 * When the series changes its ordering (`reorganize`, or the automatic group) the seasons of the new ordering that
 * have no row are created, the stored ones are relinked by number, and a stored season the ordering lacks is deleted
 * when no user entered anything in it and kept unlinked otherwise.
 */
export class SeasonRefresher {
  constructor(
    private readonly client: TmdbClient,
    private readonly seasons: SeasonRepository,
    private readonly images: ImageStore,
    private readonly catalogs: SeasonEpisodesRepository,
  ) {}

  /** Returns the episode group that was applied automatically, or null. */
  async refresh(series: Series, details: TmdbTitleResponse): Promise<string | null> {
    const stored = await this.seasons.listBySeries(series.id);
    let provider: ProviderSeason[];
    let applied: string | null = null;
    if (series.tmdbEpisodeGroup !== null) {
      const group = await this.attempt(() =>
        this.client.episodeGroup(series.tmdbEpisodeGroup ?? ''),
      );
      if (!group) return null;
      provider = mapGroupSeasons(group);
    } else {
      provider = mapRegularSeasons(details.seasons);
      const unknown = planSeasonRefresh(stored, provider)
        .unlinked.map((s) => s.number)
        .filter((number) => !provider.some((p) => p.number === number));
      if (unknown.length > 0 && series.tmdbId !== null) {
        const tmdbId = series.tmdbId;
        const groups = await this.attempt(() => loadSeasonsGroups(this.client, tmdbId));
        const chosen = pickSeasonsGroup(
          (groups ?? []).map((g) => ({
            id: g.id,
            seasonNumbers: mapGroupSeasons(g).map((s) => s.number),
          })),
          unknown,
        );
        const group = groups?.find((g) => g.id === chosen);
        if (group) {
          provider = mapGroupSeasons(group);
          applied = group.id;
        }
      }
    }

    if (applied !== null) {
      await this.reorganize(series, provider);
      return applied;
    }
    await this.applyUpdates(planSeasonRefresh(stored, provider).updates);
    return applied;
  }

  /** The seasons TMDB lists for the series in the given ordering, `null` meaning the regular seasons. */
  async providerSeasons(tmdbId: number, episodeGroup: string | null): Promise<ProviderSeason[]> {
    if (episodeGroup !== null) return mapGroupSeasons(await this.client.episodeGroup(episodeGroup));
    return mapRegularSeasons((await this.client.tv(tmdbId)).seasons);
  }

  /**
   * Makes the stored seasons of the series follow `provider`, its new ordering: relinks them by number, creates
   * the missing ones, removes the ones nobody entered anything in and drops every cached episode catalog.
   */
  async reorganize(series: Series, provider: readonly ProviderSeason[]): Promise<void> {
    const stored = await this.seasons.listBySeries(series.id);
    await this.seasons.unlinkProviderSeasons(series.id);
    const plan = planSeasonRefresh(
      stored.map((season) => ({ ...season, tmdbSeasonNumber: null })),
      provider,
      true,
    );
    await this.applyUpdates(plan.updates);
    const taken = new Set(stored.map((season) => season.number));
    for (const season of plan.unlinked) {
      if (await this.seasons.hasPersonalData(season.id)) continue;
      await this.seasons.deleteForAll(season.id);
      taken.delete(season.number);
    }
    for (const missing of plan.unmatched) {
      const number = taken.has(missing.number) ? Math.max(0, ...taken) + 1 : missing.number;
      taken.add(number);
      const cover = missing.posterUrl === null ? null : await this.download(missing.posterUrl);
      await this.seasons.create({
        ...emptySeason(),
        seriesId: series.id,
        number,
        tmdbSeasonNumber: missing.number,
        title: missing.title,
        overview: missing.overview,
        firstAirDate: missing.firstAirDate,
        episodeCount: missing.episodeCount,
        cover,
      });
    }
    await this.catalogs.deleteForSeries(series.id);
  }

  private async applyUpdates(updates: SeasonRefreshPlan['updates']): Promise<void> {
    for (const update of updates) {
      const patch: Record<string, unknown> = { ...update.fields };
      if (update.coverUrl !== null) {
        const cover = await this.download(update.coverUrl);
        if (cover !== null) patch.cover = cover;
      }
      if (Object.keys(patch).length > 0) await this.seasons.updateCatalog(update.seasonId, patch);
    }
  }

  private async attempt<T>(load: () => Promise<T>): Promise<T | undefined> {
    try {
      return await load();
    } catch {
      return undefined;
    }
  }

  private async download(url: string): Promise<string | null> {
    try {
      return await this.images.reference(url);
    } catch {
      return null;
    }
  }
}
