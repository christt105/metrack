import type { NoteKind } from './NoteKind.js';

const COMMON = [
  'title',
  'type',
  'date',
  'rewatches',
  'release_date',
  'status',
  'cover',
  'banner',
  'rating',
  'tags',
  'related',
  'category',
  'cssclasses',
  'banner_position',
  'aliases',
  'overview',
  'genres',
];

const BY_KIND: Record<NoteKind, string[]> = {
  movie: ['tmdb_id', 'original_title', 'director', 'main_actors'],
  tv: ['tmdb_id', 'thetvdb_id', 'original_title', 'main_actors', 'seasons'],
  season: ['series', 'season_number'],
  videogame: [
    'igdb_id',
    'steam_appid',
    'steamgriddb_id',
    'developer',
    'platforms',
    'available_platforms',
  ],
  book: ['openlibrary_id', 'isbn', 'author', 'authors', 'publisher', 'page_count'],
};

/** Frontmatter keys the plugin writes for a kind of note, whether or not the model keeps them. */
export function knownFields(kind: NoteKind): Set<string> {
  return new Set([...COMMON, ...BY_KIND[kind]]);
}
