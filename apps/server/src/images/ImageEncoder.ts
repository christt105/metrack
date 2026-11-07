/** Turns any supported image into the stored format: WebP, no metadata, within the size limits. */
export interface ImageEncoder {
  /** Throws `ImageRejectedError` when the bytes are not an image it can decode. */
  encode(bytes: Uint8Array): Promise<Uint8Array>;
}
