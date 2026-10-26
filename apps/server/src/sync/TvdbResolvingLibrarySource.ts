import type { Library } from './Library.js';
import type { LibrarySource } from './LibrarySource.js';

/**
 * Fills in the TMDB id of library series that Jellyfin only knows by their TheTVDB id, so they pair with
 * stored series that were added from TMDB instead of being created twice. A failed lookup leaves the
 * series as it was.
 */
export class TvdbResolvingLibrarySource implements LibrarySource {
  constructor(
    private readonly inner: LibrarySource,
    private readonly tmdbIdForTvdb: (tvdbId: number) => Promise<number | null>,
  ) {}

  async load(): Promise<Library> {
    const library = await this.inner.load();
    const series = [];
    for (const item of library.series) {
      if (item.tmdbId !== null || item.tvdbId === null) {
        series.push(item);
        continue;
      }
      const tmdbId = await this.tmdbIdForTvdb(item.tvdbId).catch(() => null);
      series.push(tmdbId === null ? item : { ...item, tmdbId });
    }
    return { ...library, series };
  }
}
