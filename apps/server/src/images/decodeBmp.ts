import type { DecodedBitmap } from './DecodedBitmap.js';
import { ImageRejectedError } from './ImageRejectedError.js';

const BI_RGB = 0;
const MAX_PIXELS = 50_000_000;

/**
 * Decodes an uncompressed BMP (1, 4, 8, 24 or 32 bits per pixel) into RGBA pixels. Image libraries for the web
 * rarely read BMP, and screenshots from emulators often come in it. Throws `ImageRejectedError` for anything else.
 */
export function decodeBmp(bytes: Uint8Array): DecodedBitmap {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.length < 54 || b.toString('ascii', 0, 2) !== 'BM') throw unsupported();
  const dataOffset = b.readUInt32LE(10);
  const headerSize = b.readUInt32LE(14);
  const width = b.readInt32LE(18);
  const rawHeight = b.readInt32LE(22);
  const bits = b.readUInt16LE(28);
  const compression = b.readUInt32LE(30);
  const height = Math.abs(rawHeight);
  if (compression !== BI_RGB || width < 1 || height < 1 || width * height > MAX_PIXELS) {
    throw unsupported();
  }
  if (![1, 4, 8, 24, 32].includes(bits)) throw unsupported();

  const stride = Math.ceil((width * bits) / 32) * 4;
  if (dataOffset + stride * height > b.length) throw unsupported();
  const palette = bits <= 8 ? readPalette(b, 14 + headerSize, bits) : [];
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const row = dataOffset + stride * (rawHeight > 0 ? height - 1 - y : y);
    for (let x = 0; x < width; x += 1) {
      const out = (y * width + x) * 4;
      if (bits >= 24) {
        const at = row + x * (bits / 8);
        pixels[out] = b[at + 2] as number;
        pixels[out + 1] = b[at + 1] as number;
        pixels[out + 2] = b[at] as number;
        pixels[out + 3] = 255;
      } else {
        const color = palette[paletteIndex(b, row, x, bits)] ?? [0, 0, 0];
        pixels.set([color[0] as number, color[1] as number, color[2] as number, 255], out);
      }
    }
  }
  return { width, height, pixels };
}

function readPalette(b: Buffer, offset: number, bits: number): number[][] {
  const used = b.readUInt32LE(46);
  const count = used === 0 ? 2 ** bits : used;
  const colors: number[][] = [];
  for (let i = 0; i < count && offset + i * 4 + 3 <= b.length; i += 1) {
    const at = offset + i * 4;
    colors.push([b[at + 2] as number, b[at + 1] as number, b[at] as number]);
  }
  return colors;
}

function paletteIndex(b: Buffer, row: number, x: number, bits: number): number {
  const bit = x * bits;
  const byte = b[row + (bit >> 3)] as number;
  const shift = 8 - bits - (bit & 7);
  return (byte >> shift) & ((1 << bits) - 1);
}

function unsupported(): ImageRejectedError {
  return new ImageRejectedError('unsupported_image', 'Unsupported or corrupt image');
}
