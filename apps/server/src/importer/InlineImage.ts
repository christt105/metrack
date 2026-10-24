/** An image embedded in a note body with `![[...]]` that exists in the vault. */
export interface InlineImage {
  /** The embed exactly as written, brackets included. */
  embed: string;
  /** Local file the embed points to. */
  path: string;
  /** Text shown if the image cannot load, the file name of the embed. */
  alt: string;
}
