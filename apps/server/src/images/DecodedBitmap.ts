/** Raw pixels, four bytes (RGBA) per pixel, rows top to bottom. */
export interface DecodedBitmap {
  width: number;
  height: number;
  pixels: Uint8Array;
}
