import type { Book, Movie, Season, Series, Tracking, Videogame } from '@metrack/domain';
import { dateField } from '../dateField.js';
import type { ExportInput } from '../ExportInput.js';
import { inlineSeasonOf } from '../inlineSeasonOf.js';
import type { Slugs } from '../Slugs.js';
import type { Field } from './Field.js';
import { MIRROR_FOLDERS } from './MIRROR_FOLDERS.js';
import type { NoteDraft } from './NoteDraft.js';
import { seriesTracking } from './seriesTracking.js';
import { statusLabel } from './statusLabel.js';

const always = (key: string, value: unknown): Field => ({ key, value, always: true });
const optional = (key: string, value: unknown): Field => ({ key, value, always: false });
const image = (key: string, value: string | null): Field => ({
  key,
  value,
  always: true,
  kind: 'image',
});
const links = (key: string, value: unknown): Field => ({ key, value, always: true, kind: 'links' });

function rating(value: number | null): string | null {
  return value === null ? null : String(value);
}

function steamAppId(value: string | null): number | string | null {
  return value !== null && /^\d+$/.test(value) ? Number(value) : value;
}

function tracking(t: Pick<Tracking, 'status' | 'finishedAt' | 'rewatches'>) {
  return {
    date: always('date', dateField(t.finishedAt)),
    rewatches: always(
      'rewatches',
      t.rewatches.flatMap((date) => dateField(date) ?? []),
    ),
    status: always('status', statusLabel(t.status)),
  };
}

function backLink(webUrl: string | null, collection: string, id: number): Field {
  return optional('metrack', webUrl === null ? null : `${webUrl}/${collection}/${id}`);
}

function movieDraft(movie: Movie, slugs: Slugs, webUrl: string | null): NoteDraft {
  const t = tracking(movie);
  return {
    path: `${MIRROR_FOLDERS.movie}/${slugs.movies.get(movie.id)!}.md`,
    fields: [
      always('title', movie.title),
      always('type', 'movie'),
      t.date,
      optional('started', dateField(movie.startedAt)),
      t.rewatches,
      always('release_date', dateField(movie.releaseDate)),
      t.status,
      image('cover', movie.cover),
      image('banner', movie.banner),
      always('rating', rating(movie.rating)),
      always('genres', movie.genres),
      always('tmdb_id', movie.tmdbId),
      always('tags', movie.tags),
      always('overview', movie.overview),
      backLink(webUrl, 'movies', movie.id),
    ],
    review: movie.review,
    defaults: { category: '[[Películas]]', related: [] },
  };
}

function seriesDrafts(
  series: Series,
  seasons: Season[],
  slugs: Slugs,
  webUrl: string | null,
): NoteDraft[] {
  const ordered = [...seasons].sort((a, b) => a.number - b.number || a.id - b.id);
  const inline = inlineSeasonOf(ordered);
  const slug = slugs.series.get(series.id)!;
  const derived = inline ?? { ...seriesTracking(ordered), rewatches: [], rating: null };
  const t = tracking(derived);
  const seasonLinks = ordered.flatMap((season) => {
    const name = slugs.seasons.get(season.id);
    return name === undefined ? [] : [`[[${name}]]`];
  });
  const seriesDraft: NoteDraft = {
    path: `${MIRROR_FOLDERS.tv}/${slug}.md`,
    fields: [
      always('title', series.title),
      always('type', 'tv'),
      t.date,
      optional('started', dateField(inline?.startedAt ?? null)),
      t.rewatches,
      always('release_date', dateField(series.firstAirDate)),
      t.status,
      image('cover', series.cover),
      image('banner', series.banner),
      always('rating', rating(derived.rating)),
      always('genres', series.genres),
      always('tmdb_id', series.tmdbId),
      optional('thetvdb_id', series.tvdbId),
      always('tags', series.tags),
      always('overview', series.overview),
      links('seasons', seasonLinks),
      backLink(webUrl, 'series', series.id),
    ],
    review: inline ? inline.review : series.review,
    defaults: { category: '[[Series]]', related: [] },
  };
  if (inline) return [seriesDraft];
  return [
    seriesDraft,
    ...ordered.map((season): NoteDraft => {
      const s = tracking(season);
      return {
        path: `${MIRROR_FOLDERS.season}/${slugs.seasons.get(season.id)!}.md`,
        fields: [
          always('title', season.title ?? `${series.title} - Season ${season.number}`),
          always('type', 'season'),
          links('series', `[[${slug}]]`),
          always('season_number', season.number),
          s.status,
          image('cover', season.cover),
          image('banner', season.banner),
          s.date,
          optional('started', dateField(season.startedAt)),
          s.rewatches,
          always('tags', season.tags),
          always('rating', rating(season.rating)),
          always('release_date', dateField(season.firstAirDate)),
          backLink(webUrl, 'seasons', season.id),
        ],
        review: season.review,
        defaults: {},
      };
    }),
  ];
}

function gameDraft(game: Videogame, slugs: Slugs, webUrl: string | null): NoteDraft {
  const t = tracking(game);
  return {
    path: `${MIRROR_FOLDERS.videogame}/${slugs.videogames.get(game.id)!}.md`,
    fields: [
      always('title', game.title),
      always('type', 'videogame'),
      t.date,
      optional('started', dateField(game.startedAt)),
      t.rewatches,
      always('release_date', dateField(game.releaseDate)),
      t.status,
      image('cover', game.cover),
      image('banner', game.banner),
      always('developer', game.developer),
      always('genres', game.genres),
      always('rating', rating(game.rating)),
      always('igdb_id', game.igdbId),
      always('steam_appid', steamAppId(game.steamAppId)),
      always('tags', game.tags),
      always('platforms', game.platforms),
      always('overview', game.overview),
      optional('steamgriddb_id', game.steamGridDbId),
      backLink(webUrl, 'games', game.id),
    ],
    review: game.review,
    defaults: { category: '[[Juegos]]', related: [] },
  };
}

function bookDraft(book: Book, slugs: Slugs, webUrl: string | null): NoteDraft {
  const t = tracking(book);
  return {
    path: `${MIRROR_FOLDERS.book}/${slugs.books.get(book.id)!}.md`,
    fields: [
      always('title', book.title),
      always('type', 'book'),
      t.date,
      optional('started', dateField(book.startedAt)),
      t.rewatches,
      always('release_date', dateField(book.releaseDate)),
      t.status,
      image('cover', book.cover),
      always('authors', book.authors),
      always('publisher', book.publisher),
      always('page_count', book.pageCount),
      always('isbn', book.isbn),
      always('openlibrary_id', book.openLibraryId),
      always('genres', book.genres),
      always('rating', rating(book.rating)),
      always('tags', book.tags),
      always('overview', book.overview),
      backLink(webUrl, 'books', book.id),
    ],
    review: book.review,
    defaults: { related: [] },
  };
}

/** What every note of the mirror should contain, before looking at the vault. */
export function buildDrafts(input: ExportInput, slugs: Slugs, webUrl: string | null): NoteDraft[] {
  return [
    ...input.movies.map((movie) => movieDraft(movie, slugs, webUrl)),
    ...input.series.flatMap((series) =>
      seriesDrafts(
        series,
        input.seasons.filter((season) => season.seriesId === series.id),
        slugs,
        webUrl,
      ),
    ),
    ...input.videogames.map((game) => gameDraft(game, slugs, webUrl)),
    ...input.books.map((book) => bookDraft(book, slugs, webUrl)),
  ];
}
