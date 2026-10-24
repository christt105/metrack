export const NOTE_KINDS = ['movie', 'tv', 'season', 'videogame', 'book'] as const;

/** The `type` values the Media Tracker plugin writes into note frontmatter. */
export type NoteKind = (typeof NOTE_KINDS)[number];
