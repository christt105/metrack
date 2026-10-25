import type { ImageSize } from './ImageSize.js';

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/**
 * Reads the format and pixel dimensions of a PNG, JPEG, WebP, GIF or BMP from its header.
 * Throws when the bytes are not one of those formats or the header is truncated.
 */
export function readImageSize(bytes: Uint8Array): ImageSize {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size =
    readPng(buffer) ??
    readJpeg(buffer) ??
    readWebp(buffer) ??
    readGif(buffer) ??
    readBmp(buffer) ??
    undefined;
  if (!size || size.width < 1 || size.height < 1) {
    throw new Error('Unsupported or corrupt image');
  }
  return size;
}

function readPng(b: Buffer): ImageSize | null {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') {
    return null;
  }
  return {
    mimeType: 'image/png',
    extension: 'png',
    width: b.readUInt32BE(16),
    height: b.readUInt32BE(20),
  };
}

function readGif(b: Buffer): ImageSize | null {
  if (b.length < 10 || !['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6))) return null;
  return {
    mimeType: 'image/gif',
    extension: 'gif',
    width: b.readUInt16LE(6),
    height: b.readUInt16LE(8),
  };
}

function readBmp(b: Buffer): ImageSize | null {
  if (b.length < 26 || b.toString('ascii', 0, 2) !== 'BM') return null;
  return {
    mimeType: 'image/bmp',
    extension: 'bmp',
    width: Math.abs(b.readInt32LE(18)),
    height: Math.abs(b.readInt32LE(22)),
  };
}

function readJpeg(b: Buffer): ImageSize | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = b[offset + 1] as number;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (JPEG_SOF_MARKERS.has(marker)) {
      return {
        mimeType: 'image/jpeg',
        extension: 'jpg',
        height: b.readUInt16BE(offset + 5),
        width: b.readUInt16BE(offset + 7),
      };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    offset += 2 + b.readUInt16BE(offset + 2);
  }
  return null;
}

function readWebp(b: Buffer): ImageSize | null {
  if (
    b.length < 30 ||
    b.toString('ascii', 0, 4) !== 'RIFF' ||
    b.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }
  const base = { mimeType: 'image/webp', extension: 'webp' };
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    return { ...base, width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { ...base, width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return { ...base, width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  }
  return null;
}
