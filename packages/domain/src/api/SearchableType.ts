export const SEARCHABLE_TYPES = ['movie', 'series', 'videogame', 'book'] as const;

/** Entity types that can be searched for and added from a provider. */
export type SearchableType = (typeof SEARCHABLE_TYPES)[number];
