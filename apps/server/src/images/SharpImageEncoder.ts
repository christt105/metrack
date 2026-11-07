import sharp, { type Sharp } from 'sharp';
import { decodeBmp } from './decodeBmp.js';
import type { ImageEncoder } from './ImageEncoder.js';
import type { ImageEncoding } from './ImageEncoding.js';
import { ImageRejectedError } from './ImageRejectedError.js';

export const DEFAULT_IMAGE_ENCODING: ImageEncoding = { maxDimension: 2560, quality: 82 };

const MAX_INPUT_PIXELS = 50_000_000;

/**
 * Re-encodes with sharp: applies the EXIF orientation, drops every metadata block (EXIF, GPS, XMP, ICC),
 * scales down to `maxDimension` and writes WebP. Animated GIF and WebP stay animated.
 */
export class SharpImageEncoder implements ImageEncoder {
  constructor(private readonly encoding: ImageEncoding = DEFAULT_IMAGE_ENCODING) {}

  async encode(bytes: Uint8Array): Promise<Uint8Array> {
    try {
      const output = await this.pipeline(bytes)
        .rotate()
        .resize({
          width: this.encoding.maxDimension,
          height: this.encoding.maxDimension,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: this.encoding.quality })
        .toBuffer();
      return new Uint8Array(output.buffer, output.byteOffset, output.byteLength);
    } catch (error) {
      if (error instanceof ImageRejectedError) throw error;
      throw new ImageRejectedError('unsupported_image', 'Unsupported or corrupt image');
    }
  }

  private pipeline(bytes: Uint8Array): Sharp {
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
      const bitmap = decodeBmp(bytes);
      return sharp(bitmap.pixels, {
        raw: { width: bitmap.width, height: bitmap.height, channels: 4 },
      });
    }
    return sharp(bytes, { animated: true, limitInputPixels: MAX_INPUT_PIXELS });
  }
}
