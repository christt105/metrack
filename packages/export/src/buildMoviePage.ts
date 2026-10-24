import type { Movie } from '@metrack/domain';
import { buildPage } from './buildPage.js';
import { dateField } from './dateField.js';
import type { Page } from './Page.js';
import type { PageContext } from './PageContext.js';
import { trackingFields } from './trackingFields.js';

export function buildMoviePage(movie: Movie, context: PageContext): Page {
  return buildPage(
    {
      section: 'movies',
      slug: context.slugs.movies.get(movie.id)!,
      fields: {
        title: movie.title,
        type: 'movie',
        tmdb_id: movie.tmdbId,
        release_date: dateField(movie.releaseDate),
        overview: movie.overview,
        genres: movie.genres,
        tags: movie.tags,
        ...trackingFields(movie),
      },
      review: movie.review,
      artwork: movie,
    },
    context,
  );
}
