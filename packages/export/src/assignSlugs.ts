import { isSafeSlug } from '@metrack/domain';
import type { ExportInput } from './ExportInput.js';
import { inlineSeasonOf } from './inlineSeasonOf.js';
import { SlugRegistry } from './SlugRegistry.js';
import type { Slugs } from './Slugs.js';
import { yearOf } from './yearOf.js';

interface Named {
  id: number;
  slug: string | null;
}

function withYear(title: string, date: string | null): string {
  const year = yearOf(date);
  return year === null ? title : `${title} (${year})`;
}

function keepGiven<T extends Named>(items: T[], map: Map<number, string>, registry: SlugRegistry) {
  for (const item of items) {
    if (item.slug !== null && isSafeSlug(item.slug)) {
      map.set(item.id, registry.claimVerbatim(item.slug));
    }
  }
}

function deriveMissing<T extends Named>(
  items: T[],
  map: Map<number, string>,
  registry: SlugRegistry,
  name: (item: T) => string,
) {
  for (const item of items) {
    if (!map.has(item.id)) map.set(item.id, registry.claimFromTitle(name(item)));
  }
}

/**
 * Names every page. Names the vault gave are kept so addresses do not change, unless they are not a
 * safe folder name; anything else is derived from its title, in id order so the result does not
 * depend on call order. A season title that does not name its series (TMDB's "Temporada 2") is prefixed
 * with the series name.
 */
export function assignSlugs(input: ExportInput): Slugs {
  const registry = new SlugRegistry();
  const slugs: Slugs = {
    movies: new Map(),
    series: new Map(),
    seasons: new Map(),
    videogames: new Map(),
    books: new Map(),
    all: registry.names(),
  };
  const seasonPages = input.series.flatMap((series) => {
    const seasons = input.seasons.filter((season) => season.seriesId === series.id);
    return inlineSeasonOf(seasons) ? [] : seasons;
  });

  keepGiven(input.movies, slugs.movies, registry);
  keepGiven(input.series, slugs.series, registry);
  keepGiven(input.videogames, slugs.videogames, registry);
  keepGiven(input.books, slugs.books, registry);
  keepGiven(seasonPages, slugs.seasons, registry);

  deriveMissing(input.movies, slugs.movies, registry, (m) => withYear(m.title, m.releaseDate));
  deriveMissing(input.series, slugs.series, registry, (s) => withYear(s.title, s.firstAirDate));
  deriveMissing(input.videogames, slugs.videogames, registry, (g) =>
    withYear(g.title, g.releaseDate),
  );
  deriveMissing(input.books, slugs.books, registry, (b) => withYear(b.title, b.releaseDate));
  const seriesTitles = new Map(input.series.map((series) => [series.id, series.title]));
  deriveMissing(seasonPages, slugs.seasons, registry, (season) => {
    const parent = slugs.series.get(season.seriesId) ?? 'series';
    const own = season.title ?? `Season ${season.number}`;
    const seriesTitle = seriesTitles.get(season.seriesId);
    const named =
      seriesTitle !== undefined && own.toLowerCase().includes(seriesTitle.toLowerCase());
    return named ? own : `${parent} - ${own}`;
  });
  return slugs;
}
