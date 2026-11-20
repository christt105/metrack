/** A catalog game that was added with its artwork linked but not yet archived. */
export interface PendingGameArtwork {
  id: number;
  igdbId: number | null;
  steamAppId: string | null;
  cover: string | null;
  banner: string | null;
}
