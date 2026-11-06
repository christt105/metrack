import type { WatchlistEntry } from '@metrack/domain';
import type { MediaEditor } from '../media/MediaEditor.js';
import type {
  MovieRepository,
  SeasonRepository,
  SeriesRepository,
} from '../storage/repositories/index.js';

export type WatchCollection = 'movies' | 'series';

/** The movies and series that are followed for release alerts. */
export class WatchlistService {
  constructor(
    private readonly editor: MediaEditor,
    private readonly movies: MovieRepository,
    private readonly series: SeriesRepository,
    private readonly seasons: SeasonRepository,
  ) {}

  /** Followed movies and series ordered by title. */
  async list(): Promise<WatchlistEntry[]> {
    const movies = (await this.movies.listFollowed()).map<WatchlistEntry>((m) => ({
      type: 'movie',
      id: m.id,
      title: m.title,
      cover: m.cover,
      releaseDate: m.releaseDate,
    }));
    const series: WatchlistEntry[] = [];
    for (const s of await this.series.listFollowed()) {
      const dates = (await this.seasons.listBySeries(s.id))
        .map((season) => season.firstAirDate)
        .filter((date): date is string => date !== null)
        .sort();
      series.push({
        type: 'series',
        id: s.id,
        title: s.title,
        cover: s.cover,
        releaseDate: dates[dates.length - 1] ?? s.firstAirDate,
      });
    }
    return [...movies, ...series].sort((a, b) => a.title.localeCompare(b.title));
  }

  /** Starts or stops following. Throws the editor's not found error for an unknown id. */
  async setFollowed(collection: WatchCollection, id: number, follow: boolean): Promise<void> {
    await this.editor.patch(collection, id, { follow });
  }
}
