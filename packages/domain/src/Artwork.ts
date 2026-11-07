/** Cover and banner: a stored image reference (`/api/images/<hash>`) or the URL of a linked provider image. */
export interface Artwork {
  cover: string | null;
  banner: string | null;
}
