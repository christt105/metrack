export const MEDIA_TYPES = ['movie', 'series', 'season', 'videogame', 'book'] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];
