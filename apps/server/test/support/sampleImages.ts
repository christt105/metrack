import sharp from 'sharp';

export function png(width: number, height: number, salt = 0): Buffer {
  const b = Buffer.alloc(33 + salt);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

export function jpeg(width: number, height: number): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, ...Array<number>(14).fill(0)]);
  const sof = Buffer.alloc(19);
  sof.set([0xff, 0xc0, 0x00, 0x11, 0x08]);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]);
}

export function webpLossy(width: number, height: number): Buffer {
  const b = Buffer.alloc(40);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  b.write('VP8 ', 12, 'ascii');
  b.writeUInt16LE(width, 26);
  b.writeUInt16LE(height, 28);
  return b;
}

export function webpLossless(width: number, height: number): Buffer {
  const b = Buffer.alloc(40);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  b.write('VP8L', 12, 'ascii');
  b[20] = 0x2f;
  b.writeUInt32LE((width - 1) | ((height - 1) << 14), 21);
  return b;
}

export function webpExtended(width: number, height: number): Buffer {
  const b = Buffer.alloc(40);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  b.write('VP8X', 12, 'ascii');
  b.writeUIntLE(width - 1, 24, 3);
  b.writeUIntLE(height - 1, 27, 3);
  return b;
}

/** A real, decodable image of one colour, made with sharp. */
export async function solidImage(
  width: number,
  height: number,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  color = { r: 200, g: 40, b: 90 },
): Promise<Buffer> {
  const image = sharp({ create: { width, height, channels: 3, background: color } });
  return image[format]().toBuffer();
}

/** A JPEG photo carrying EXIF with a camera model and GPS position, rotated by its orientation tag. */
export async function photoWithExif(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 120, b: 30 } } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({
      IFD0: { Model: 'Test Camera' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '40/1 25/1 0/1' },
    })
    .toBuffer();
}

/** An uncompressed 24-bit BMP of one colour. */
export function bmp24(width: number, height: number, rgb: [number, number, number]): Buffer {
  const stride = Math.ceil((width * 3) / 4) * 4;
  const b = Buffer.alloc(54 + stride * height);
  b.write('BM', 0, 'ascii');
  b.writeUInt32LE(b.length, 2);
  b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14);
  b.writeInt32LE(width, 18);
  b.writeInt32LE(height, 22);
  b.writeUInt16LE(1, 26);
  b.writeUInt16LE(24, 28);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = 54 + y * stride + x * 3;
      b[at] = rgb[2];
      b[at + 1] = rgb[1];
      b[at + 2] = rgb[0];
    }
  }
  return b;
}

/** A PNG of random pixels, which no encoder can shrink much. */
export async function noiseImage(width: number, height: number): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = Math.floor(Math.random() * 256);
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}
