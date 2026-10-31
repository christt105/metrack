import type { Season, Series } from '@metrack/domain';
import { buildPage } from './buildPage.js';
import { dateField } from './dateField.js';
import { inlineSeasonOf } from './inlineSeasonOf.js';
import type { Page } from './Page.js';
import type { PageContext } from './PageContext.js';
import { statusKey } from './statusKey.js';
import { trackingFields } from './trackingFields.js';

/**
 * The pages of a series. A series without season pages carries its single season's tracking on
 * its own page. Otherwise the series page only groups its seasons and each season has a page, which
 * falls back to the series cover and banner when it has none of its own.
 */
export function buildSeriesPages(series: Series, seasons: Season[], context: PageContext): Page[] {
  const ordered = [...seasons].sort((a, b) => a.number - b.number || a.id - b.id);
  const slug = context.slugs.series.get(series.id)!;
  const inline = inlineSeasonOf(ordered);
  const seasonSlugs = ordered.flatMap((season) => context.slugs.seasons.get(season.id) ?? []);

  const seriesPage = buildPage(
    {
      section: 'tv',
      slug,
      fields: {
        title: series.title,
        type: 'tv',
        tmdb_id: series.tmdbId,
        thetvdb_id: series.tvdbId,
        release_date: dateField(series.firstAirDate),
        overview: series.overview,
        genres: series.genres,
        tags: series.tags,
        seasons: seasonSlugs,
        ...(inline ? trackingFields(inline) : { status: statusKey('planned') }),
      },
      review: inline ? inline.review : series.review,
      artwork: series,
    },
    context,
  );

  const seasonPages = inline
    ? []
    : ordered.map((season) =>
        buildPage(
          {
            section: 'seasons',
            slug: context.slugs.seasons.get(season.id)!,
            fields: {
              title: season.title ?? `${series.title} - Season ${season.number}`,
              type: 'season',
              series: slug,
              season_number: season.number,
              release_date: dateField(season.firstAirDate),
              overview: season.overview,
              tags: season.tags,
              ...trackingFields(season),
            },
            review: season.review,
            artwork: {
              cover: season.cover ?? series.cover,
              banner: season.banner ?? series.banner,
            },
          },
          context,
        ),
      );
  return [seriesPage, ...seasonPages];
}
