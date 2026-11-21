import {
  fillerSlugCandidates,
  matchFillerEpisodes,
  parseFillerSlug,
  type FillerCounts,
  type FillerEntry,
  type FillerPreviewResponse,
  type FillerSeason,
} from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import type { SeasonEpisodesService } from '../seasons/SeasonEpisodesService.js';
import type { SeasonRepository } from '../storage/repositories/SeasonRepository.js';
import type { SeasonFillerRepository } from '../storage/repositories/SeasonFillerRepository.js';
import type { SeriesRepository } from '../storage/repositories/SeriesRepository.js';
import { fillerListUrl, type FillerListClient } from './FillerListClient.js';

export interface FillerServiceDeps {
  series: SeriesRepository;
  seasons: SeasonRepository;
  episodes: SeasonEpisodesService;
  list: FillerListClient;
  stored: SeasonFillerRepository;
}

/**
 * Classifies the episodes of a series as filler, mixed or canon with the list AnimeFillerList keeps for the show,
 * read on demand. When the match succeeds and the caller may write, the category of every episode and the slug are
 * stored against the seasons, replacing what was there, so the season lists can flag the episodes; a failed
 * preview stores nothing. The show is found by an explicit slug or, without one, by the slug of the
 * series' title and then of its original title. The pairing is by absolute number and is refused unless the
 * series' episodes (seasons from 1, each in catalog order) are as many as the list's; see `matchFillerEpisodes`.
 * It costs one request to AnimeFillerList per slug tried plus the TMDB requests of seasons without a complete
 * catalog, all inside the Worker's subrequest budget.
 */
export class FillerService {
  constructor(private readonly deps: FillerServiceDeps) {}

  async preview(
    seriesId: number,
    explicitSlug?: string,
    persist = false,
  ): Promise<{ response: FillerPreviewResponse; episodeCountChanged: boolean }> {
    const series = await this.deps.series.get(seriesId);
    if (!series) throw ApiError.notFound();
    let candidates: string[];
    if (explicitSlug !== undefined && explicitSlug !== '') {
      const slug = parseFillerSlug(explicitSlug);
      if (slug === null) {
        throw ApiError.badRequest(
          'invalid_filler_slug',
          'Enter the show name as AnimeFillerList writes it in its address, or that address',
        );
      }
      candidates = [slug];
    } else {
      candidates = fillerSlugCandidates(series.title, series.originalTitle);
    }
    const found = await this.find(candidates);
    if (!found) {
      throw new ApiError(404, 'filler_not_found', 'AnimeFillerList has no list for this series', {
        tried: candidates,
      });
    }
    const seasons: FillerSeason[] = [];
    let episodeCountChanged = false;
    const watched = new Map<string, { watched: boolean; skipped: boolean }>();
    const owned = (await this.deps.seasons.listBySeries(seriesId)).filter((s) => s.number > 0);
    for (const season of owned) {
      const { response, episodeCountChanged: changed } = await this.deps.episodes.get(season.id);
      episodeCountChanged ||= changed;
      if (response.source === 'numbers' || !response.complete) {
        throw ApiError.conflict(
          'filler_catalog_incomplete',
          `The episodes of season ${season.number} are not available yet, try again later`,
          { seasonNumber: season.number },
        );
      }
      seasons.push({
        seasonId: season.id,
        seasonNumber: season.number,
        episodes: response.episodes,
      });
      for (const episode of response.episodes) {
        watched.set(`${season.id}:${episode.key}`, {
          watched: episode.watched,
          skipped: episode.skipped,
        });
      }
    }
    const match = matchFillerEpisodes(found.entries, seasons);
    if (!match.ok) {
      throw ApiError.conflict(
        match.code,
        `The series has ${match.ours} episodes and AnimeFillerList lists ${match.theirs}`,
        {
          ours: match.ours,
          theirs: match.theirs,
          slug: found.slug,
          sourceUrl: fillerListUrl(found.slug),
        },
      );
    }
    if (persist) {
      await this.deps.stored.replaceForSeries(
        seriesId,
        seasons.map((season) => ({
          seasonId: season.seasonId,
          slug: found.slug,
          categories: Object.fromEntries(
            match.episodes
              .filter((episode) => episode.seasonId === season.seasonId)
              .map((episode) => [episode.key, episode.category]),
          ),
        })),
      );
    }
    const counts: FillerCounts = { filler: 0, mixed: 0, mangaCanon: 0, animeCanon: 0 };
    for (const episode of match.episodes) counts[episode.category] += 1;
    return {
      response: {
        slug: found.slug,
        sourceUrl: fillerListUrl(found.slug),
        counts,
        episodes: match.episodes.map((episode) => ({
          ...episode,
          watched: watched.get(`${episode.seasonId}:${episode.key}`)?.watched ?? false,
          skipped: watched.get(`${episode.seasonId}:${episode.key}`)?.skipped ?? false,
        })),
      },
      episodeCountChanged,
    };
  }

  private async find(
    candidates: readonly string[],
  ): Promise<{ slug: string; entries: FillerEntry[] } | undefined> {
    for (const slug of candidates) {
      let entries: FillerEntry[];
      try {
        entries = await this.deps.list.list(slug);
      } catch {
        throw new ApiError(
          502,
          'filler_source_unavailable',
          'AnimeFillerList could not be read, try again later',
        );
      }
      if (entries.length > 0) return { slug, entries };
    }
    return undefined;
  }
}
