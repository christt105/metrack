import type { NoteKind } from './NoteKind.js';

/** One parsed note of the Media Tracker folder. */
export interface VaultNote {
  /** Path relative to the Media Tracker folder, using forward slashes. */
  path: string;
  /** File name without the `.md` extension. */
  name: string;
  kind: NoteKind;
  frontmatter: Record<string, unknown>;
  body: string;
}
