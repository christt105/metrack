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
  list(): WatchlistEntry[] {
    const movies = this.movies.listFollowed().map<WatchlistEntry>((m) => ({
      type: 'movie',
      id: m.id,
      title: m.title,
      cover: m.cover,
      releaseDate: m.releaseDate,
    }));
    const series = this.series.listFollowed().map<WatchlistEntry>((s) => {
      const dates = this.seasons
        .listBySeries(s.id)
        .map((season) => season.firstAirDate)
        .filter((date): date is string => date !== null)
        .sort();
      return {
        type: 'series',
        id: s.id,
        title: s.title,
        cover: s.cover,
        releaseDate: dates[dates.length - 1] ?? s.firstAirDate,
      };
    });
    return [...movies, ...series].sort((a, b) => a.title.localeCompare(b.title));
  }

  /** Starts or stops following. Throws the editor's not found error for an unknown id. */
  setFollowed(collection: WatchCollection, id: number, follow: boolean): void {
    this.editor.patch(collection, id, { follow });
  }
}
