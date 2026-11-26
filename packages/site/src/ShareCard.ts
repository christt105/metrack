/** What a chat or social network shows when someone shares a link to the page. */
export interface ShareCard {
  /** Absolute address of the picture, or null for none. */
  image: string | null;
  /** Whether the picture is wide enough to be shown large above the text. */
  wide: boolean;
}
