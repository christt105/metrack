import {
  applyEpisodeOperation,
  countWatchedEpisodes,
  deriveSeasonTracking,
  materializeEpisodeWatches,
  sameEpisodeWatches,
  type EpisodeOperation,
  type SeasonEpisodesUpdateResponse,
  type SeasonTracking,
  isEpisodeCatalogStale,
  isSeasonAiring,
  matchEpisodeCatalog,
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
 * again. The catalog never changes a season's stored episode count (the sync owns it, and TMDB may split seasons
 * differently from Jellyfin); it only fills a missing one. A catalog whose aired episodes do not match the stored
 * count is still stored but not used: the answer lists bare numbers and reports the mismatch. A refresh that
 * renumbers the episodes moves every user's watches of the season by TMDB id.
 */
export class SeasonEpisodesService {
  private readonly now: () => Date;

  constructor(private readonly deps: SeasonEpisodesDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async get(seasonId: number): Promise<SeasonEpisodesResult> {
    const loaded = await this.load(seasonId);
    return {
      response: this.respond(
        loaded.season,
        loaded.usable,
        loaded.episodes,
        loaded.watched,
        loaded.mismatch,
      ),
      episodeCountChanged: loaded.episodeCountChanged,
    };
  }

  /**
   * Applies one operation to the user's watches of the season and moves the season's tracking along (see
   * `deriveSeasonTracking`), writing both in one atomic step. A completed season without stored watches counts as
   * all watched, so its row is created first. Removing episodes never changes the status or the dates: undoing a
   * mark with `unmark` restores the watches exactly, but a status the mark changed stays.
   */
  async update(
    seasonId: number,
    operation: EpisodeOperation,
  ): Promise<{ response: SeasonEpisodesUpdateResponse; episodeCountChanged: boolean }> {
    const loaded = await this.load(seasonId);
    const { season, usable, episodes, watched, mismatch } = loaded;
    const numbers = new Set(episodes.map((episode) => episode.number));
    for (const number of operation.op === 'setViewings' ? [operation.number] : operation.numbers) {
      if (!numbers.has(number)) {
        throw ApiError.badRequest(
          'episode_out_of_range',
          `Episode ${number} is not one of the ${episodes.length} episodes of this season`,
        );
      }
    }
    if (operation.op === 'setViewings') {
      for (const viewing of operation.viewings) {
        if (viewing.finishedAt === null || (viewing.startedAt ?? '') > viewing.finishedAt) {
          throw ApiError.badRequest(
            'invalid_viewing',
            'An episode viewing needs a finish date that is not before its start',
          );
        }
      }
    }
    const base =
      watched ?? (season.status === 'completed' ? materializeEpisodeWatches(episodes.length) : {});
    const next = applyEpisodeOperation(base, operation);
    const before: SeasonTracking = {
      status: season.status,
      startedAt: season.startedAt,
      finishedAt: season.finishedAt,
      rewatches: season.rewatches,
    };
    const derived =
      operation.op === 'unmark'
        ? before
        : deriveSeasonTracking({
            tracking: before,
            episodes: episodes.map(({ number, airDate }) => ({ number, airDate })),
            watches: next,
            baseline: base,
            today: this.today(),
          });
    const tracking: SeasonTracking = {
      status: derived.status,
      startedAt: derived.startedAt,
      finishedAt: derived.finishedAt,
      rewatches: derived.rewatches,
    };
    const trackingChanged = JSON.stringify(tracking) !== JSON.stringify(before);
    const watchesChanged = !sameEpisodeWatches(base, next);
    if (watchesChanged || trackingChanged) {
      await this.deps.watches.set(seasonId, next, trackingChanged ? tracking : undefined);
    }
    const stored = watchesChanged || trackingChanged ? next : watched;
    return {
      response: {
        ...this.respond(season, usable, episodes, stored, mismatch),
        tracking,
      },
      episodeCountChanged: loaded.episodeCountChanged,
    };
  }

  private async load(seasonId: number) {
    const season = await this.deps.seasons.get(seasonId);
    if (!season) throw ApiError.notFound();
    const series = await this.deps.series.get(season.seriesId);
    const stored = await this.deps.catalog.get(seasonId);
    let catalog = stored;
    let storedCount = season.episodeCount;
    let episodeCountChanged = false;
    if (series && series.tmdbId !== null && this.isStale(season, series, stored)) {
      const fetched = await this.fetch(season, series);
      if (fetched) {
        catalog = fetched;
        await this.deps.catalog.put(fetched);
        if (storedCount === null) {
          storedCount = fetched.episodes.length;
          await this.deps.seasons.updateCatalog(seasonId, { episodeCount: storedCount });
          episodeCountChanged = true;
        }
        if (stored && matchEpisodeCatalog(storedCount, fetched.episodes, this.today()).applies) {
          await this.remapUsers(seasonId, stored.episodes, fetched.episodes);
        }
      }
    }
    const match = catalog
      ? matchEpisodeCatalog(storedCount, catalog.episodes, this.today())
      : undefined;
    const usable = match?.applies ? catalog : undefined;
    const episodes = usable?.episodes ?? numberedEpisodes(storedCount);
    const watched = await this.deps.watches.get(seasonId);
    return {
      season,
      usable,
      episodes,
      watched,
      mismatch: match?.mismatch ?? null,
      episodeCountChanged,
    };
  }

  private today(): string {
    return this.now().toISOString().slice(0, 10);
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
    catalogMismatch: { catalogEpisodes: number } | null,
  ): SeasonEpisodesResult['response'] {
    const allWatched = stored === undefined && season.status === 'completed';
    const watched = stored ?? {};
    return {
      seasonId: season.id,
      source: catalog?.source ?? 'numbers',
      fetchedAt: catalog?.fetchedAt ?? null,
      episodeCount: episodes.length,
      catalogMismatch,
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
