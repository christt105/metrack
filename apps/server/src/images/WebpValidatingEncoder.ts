import type { ImageEncoder } from './ImageEncoder.js';
import { ImageRejectedError } from './ImageRejectedError.js';
import { readWebpHeader } from './readWebpHeader.js';
import type { WebpValidationLimits } from './WebpValidationLimits.js';

/**
 * Accepts only real WebP files within the limits and returns them unchanged: the browser already recoded the
 * image, and nothing here can decode or re-encode (so it also runs where sharp does not).
 */
export class WebpValidatingEncoder implements ImageEncoder {
  constructor(private readonly limits: WebpValidationLimits) {}

  async encode(bytes: Uint8Array): Promise<Uint8Array> {
    if (bytes.byteLength > this.limits.maxBytes) {
      throw new ImageRejectedError('image_too_large', 'The image is too large');
    }
    const header = readWebpHeader(bytes);
    if (!header) throw new ImageRejectedError('unsupported_image', 'Only WebP images are accepted');
    if (Math.max(header.width, header.height) > this.limits.maxDimension) {
      throw new ImageRejectedError(
        'image_too_large',
        `The image is larger than ${this.limits.maxDimension} px`,
      );
    }
    return bytes;
  }
}
