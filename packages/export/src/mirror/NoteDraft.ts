import type { Field } from './Field.js';

/** The fields and body a note should have before it is merged with the note already on disk. */
export interface NoteDraft {
  path: string;
  fields: Field[];
  /** Review in stored form, with `![alt](/api/images/<hash>)` images. */
  review: string | null;
  /** Front matter only written when the note is new. */
  defaults: Record<string, unknown>;
}
