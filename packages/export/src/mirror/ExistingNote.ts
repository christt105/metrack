/** A note already in the vault, as parsed from disk. */
export interface ExistingNote {
  frontmatter: Record<string, unknown>;
  body: string;
}
