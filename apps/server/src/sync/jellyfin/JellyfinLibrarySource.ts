import type { LibraryEpisode, LibrarySeason, LibrarySeries } from '@metrack/domain';
import type { Library } from '../Library.js';
import type { LibrarySource } from '../LibrarySource.js';
import type { JellyfinClient } from './JellyfinClient.js';
import type { JellyfinItem } from './JellyfinItem.js';
import { providerId } from './providerId.js';
import { ticksToSeconds } from './ticksToSeconds.js';

function dateOf(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null;
}

function toEpisode(item: JellyfinItem): LibraryEpisode {
  return {
    jellyfinId: item.Id,
    number: item.IndexNumber ?? null,
    airDate: dateOf(item.PremiereDate),
    runtimeSeconds: ticksToSeconds(item.RunTimeTicks),
    available: item.LocationType !== 'Virtual',
    played: item.UserData?.Played === true,
  };
}

/** Builds the library from the Jellyfin API: movies, and for every series its seasons, episodes and provider ids. */
export class JellyfinLibrarySource implements LibrarySource {
  constructor(private readonly client: JellyfinClient) {}

  async load(): Promise<Library> {
    const movies = (await this.client.listMovies()).map((item) => ({
      jellyfinId: item.Id,
      title: item.Name ?? '',
      year: item.ProductionYear ?? null,
      tmdbId: providerId(item, 'Tmdb'),
      runtimeSeconds: ticksToSeconds(item.RunTimeTicks),
      played: item.UserData?.Played === true,
    }));
    const series: LibrarySeries[] = [];
    for (const item of await this.client.listSeries()) {
      series.push({
        jellyfinId: item.Id,
        title: item.Name ?? '',
        year: item.ProductionYear ?? null,
        tmdbId: providerId(item, 'Tmdb'),
        tvdbId: providerId(item, 'Tvdb'),
        seasons: await this.loadSeasons(item.Id),
      });
    }
    return { movies, series };
  }

  private async loadSeasons(seriesId: string): Promise<LibrarySeason[]> {
    const [seasons, episodes] = await Promise.all([
      this.client.listSeasons(seriesId),
      this.client.listEpisodes(seriesId),
    ]);
    return seasons.flatMap((season) =>
      season.IndexNumber === null || season.IndexNumber === undefined
        ? []
        : [
            {
              jellyfinId: season.Id,
              number: season.IndexNumber,
              title: null,
              episodes: episodes.filter((e) => e.SeasonId === season.Id).map(toEpisode),
            },
          ],
    );
  }
}
