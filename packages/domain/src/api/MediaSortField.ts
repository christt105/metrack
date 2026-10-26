export const MEDIA_SORT_FIELDS = [
  'recent',
  'title',
  'rating',
  'startedAt',
  'finishedAt',
  'releaseDate',
  'id',
] as const;

export type MediaSortField = (typeof MEDIA_SORT_FIELDS)[number];
