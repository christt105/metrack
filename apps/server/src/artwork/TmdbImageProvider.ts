import type { ImageCandidate, ImageKind, MediaType, Season, Series } from '@metrack/domain';
import { TMDB_IMAGE_BASE, TMDB_IMAGE_HOST, type TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { TmdbImage } from '../providers/tmdb/TmdbImage.js';
import type { ImageProvider } from './ImageProvider.js';
import type { ImageSubject } from './ImageSubject.js';

const THUMB_BASE = 'https://image.tmdb.org/t/p';

export class TmdbImageProvider implements ImageProvider {
  readonly name = 'tmdb';

  constructor(private readonly client: TmdbClient) {}

  supports(type: MediaType): boolean {
    return type === 'movie' || type === 'series' || type === 'season';
  }

  async candidates(subject: ImageSubject, kind: ImageKind): Promise<ImageCandidate[]> {
    const images = await this.load(subject, kind);
    const size = kind === 'cover' ? 'w342' : 'w780';
    return images.map((image) => ({
      provider: this.name,
      url: `${TMDB_IMAGE_BASE}${image.file_path}`,
      thumbUrl: `${THUMB_BASE}/${size}${image.file_path}`,
      width: image.width,
      height: image.height,
      score: image.vote_average ?? null,
      language: image.iso_639_1 ?? null,
    }));
  }

  owns(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && parsed.hostname === TMDB_IMAGE_HOST;
    } catch {
      return false;
    }
  }

  private async load(subject: ImageSubject, kind: ImageKind): Promise<TmdbImage[]> {
    if (subject.type === 'movie' && subject.entity.tmdbId !== null) {
      const response = await this.client.images('movie', subject.entity.tmdbId);
      return (kind === 'cover' ? response.posters : response.backdrops) ?? [];
    }
    if (subject.type === 'series' && subject.entity.tmdbId !== null) {
      const response = await this.client.images('tv', subject.entity.tmdbId);
      return (kind === 'cover' ? response.posters : response.backdrops) ?? [];
    }
    if (subject.type === 'season' && kind === 'cover' && subject.series.tmdbId !== null) {
      const tmdbId = subject.series.tmdbId;
      const [own, shared] = await Promise.all([
        this.seasonPosters(tmdbId, subject.series, subject.entity),
        this.seriesPosters(tmdbId),
      ]);
      return [...own, ...shared];
    }
    return [];
  }

  private async seriesPosters(tmdbId: number): Promise<TmdbImage[]> {
    try {
      return (await this.client.images('tv', tmdbId)).posters ?? [];
    } catch {
      return [];
    }
  }

  private async seasonPosters(
    tmdbId: number,
    series: Series,
    season: Season,
  ): Promise<TmdbImage[]> {
    try {
      const number = await this.tmdbSeasonOf(series, season);
      if (number === null) return [];
      return (await this.client.seasonImages(tmdbId, number)).posters ?? [];
    } catch {
      return [];
    }
  }

  /** The regular TMDB season the season's episodes fall in: with an episode group, the one its first episode has. */
  private async tmdbSeasonOf(series: Series, season: Season): Promise<number | null> {
    const number = season.tmdbSeasonNumber ?? season.number;
    if (series.tmdbEpisodeGroup === null) return number;
    const group = await this.client.episodeGroup(series.tmdbEpisodeGroup);
    const first = group.groups?.find((g) => g.order === number)?.episodes?.[0];
    return first?.season_number ?? null;
  }
}
