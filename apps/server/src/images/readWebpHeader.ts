import type { WebpHeader } from './WebpHeader.js';

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length));

/**
 * Reads the pixel dimensions of a still or animated WebP (VP8, VP8L or VP8X) from its header, or returns
 * `null` when the bytes are not a complete WebP container with a decodable first chunk. Pure and free of Node APIs.
 */
export function readWebpHeader(bytes: Uint8Array): WebpHeader | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 > bytes.length) return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8 ') {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return dimensions(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
  }
  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) return null;
    const bits = view.getUint32(21, true);
    return dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (chunk === 'VP8X') {
    const read24 = (offset: number): number =>
      (bytes[offset] as number) |
      ((bytes[offset + 1] as number) << 8) |
      ((bytes[offset + 2] as number) << 16);
    return dimensions(read24(24) + 1, read24(27) + 1);
  }
  return null;
}

function dimensions(width: number, height: number): WebpHeader | null {
  return width >= 1 && height >= 1 ? { width, height } : null;
}
