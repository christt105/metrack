import { buildLibrary, type Library } from '@metrack/site';
import type { UserScope } from '../users/UserScope.js';
import type { PublicSiteSources } from './PublicSiteSources.js';

/** Reads one user's data, as that user, and keeps what a public page may show. */
export function loadLibrary(
  sources: PublicSiteSources,
  scope: UserScope,
  userId: number,
  handle: string,
): Promise<Library> {
  return scope.run(userId, async () =>
    buildLibrary({
      handle,
      movies: await sources.movies.list(),
      series: await sources.series.list(),
      seasons: await sources.seasons.list(),
      videogames: await sources.videogames.list(),
      books: await sources.books.list(),
    }),
  );
}
