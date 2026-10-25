/** Every table column that may hold an image reference. */
export const IMAGE_COLUMNS: readonly { table: string; column: string }[] = [
  { table: 'movie', column: 'cover' },
  { table: 'movie', column: 'banner' },
  { table: 'series', column: 'cover' },
  { table: 'series', column: 'banner' },
  { table: 'season', column: 'cover' },
  { table: 'season', column: 'banner' },
  { table: 'videogame', column: 'cover' },
  { table: 'videogame', column: 'banner' },
  { table: 'book', column: 'cover' },
];
