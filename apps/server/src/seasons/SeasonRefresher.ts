import {
  pickSeasonsGroup,
  planSeasonRefresh,
  type ProviderSeason,
  type Series,
} from '@metrack/domain';
import type { ImageStore } from '../images/ImageStore.js';
import { mapGroupSeasons } from '../providers/tmdb/mapGroupSeasons.js';
import { mapRegularSeasons } from '../providers/tmdb/mapRegularSeasons.js';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { TmdbTitleResponse } from '../providers/tmdb/TmdbTitleResponse.js';
import type { SeasonRepository } from '../storage/repositories/SeasonRepository.js';
import { loadSeasonsGroups } from './loadSeasonsGroups.js';

/**
 * Brings the stored seasons of a series in line with TMDB: title, overview, first air date and episode count
 * follow the provider, a cover is filled in only when the season has none, and seasons without a provider
 * number are linked by the date of their first episode. A series that follows an episode group is read from
 * that group. A season that TMDB's regular seasons do not know makes the series follow the only "Seasons"
 * group that has it, which is returned so the caller records it. Provider failures leave the seasons as they were.
 */
export class SeasonRefresher {
  constructor(
    private readonly client: TmdbClient,
    private readonly seasons: SeasonRepository,
    private readonly images: ImageStore,
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

    let current = stored;
    if (applied !== null) {
      await this.seasons.unlinkProviderSeasons(series.id);
      current = stored.map((season) => ({ ...season, tmdbSeasonNumber: null }));
    }
    const plan = planSeasonRefresh(current, provider, applied !== null);
    for (const update of plan.updates) {
      const patch: Record<string, unknown> = { ...update.fields };
      if (update.coverUrl !== null) {
        const cover = await this.download(update.coverUrl);
        if (cover !== null) patch.cover = cover;
      }
      if (Object.keys(patch).length > 0) await this.seasons.updateCatalog(update.seasonId, patch);
    }
    return applied;
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
