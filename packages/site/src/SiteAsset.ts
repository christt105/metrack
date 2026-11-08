/** A file every public page may load: a stylesheet, a script, a font or an image. */
export interface SiteAsset {
  contentType: string;
  body: string | Uint8Array;
}
