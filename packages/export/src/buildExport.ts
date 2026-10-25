import { assignSlugs } from './assignSlugs.js';
import { buildBookPage } from './buildBookPage.js';
import { buildGamePage } from './buildGamePage.js';
import { buildMoviePage } from './buildMoviePage.js';
import { buildSeriesPages } from './buildSeriesPages.js';
import type { ExportedFile } from './ExportedFile.js';
import type { ExportInput } from './ExportInput.js';
import type { Page } from './Page.js';
import { renderPage } from './renderPage.js';

/**
 * Builds the Hugo content tree for the theme from the stored data. Pure and deterministic: the
 * same input always yields the same files, sorted by path.
 */
export function buildExport(input: ExportInput): ExportedFile[] {
  const context = {
    slugs: assignSlugs(input),
    imagesByRef: new Map(input.images.map((image) => [image.ref, image])),
  };
  const pages: Page[] = [
    ...input.movies.map((movie) => buildMoviePage(movie, context)),
    ...input.series.flatMap((series) =>
      buildSeriesPages(
        series,
        input.seasons.filter((season) => season.seriesId === series.id),
        context,
      ),
    ),
    ...input.videogames.map((game) => buildGamePage(game, context)),
    ...input.books.map((book) => buildBookPage(book, context)),
  ];
  return pages
    .flatMap((page) => renderPage(page, context))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
