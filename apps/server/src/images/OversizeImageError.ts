import { ImageRejectedError } from './ImageRejectedError.js';

/** A fetched response that announced itself as an image but was over the size limit. */
export class OversizeImageError extends ImageRejectedError {
  constructor(message: string) {
    super('image_too_large', message);
    this.name = 'OversizeImageError';
  }
}
