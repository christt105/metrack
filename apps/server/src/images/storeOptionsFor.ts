import type { ImageLimits } from './ImageLimits.js';
import type { ImageStoreOptions } from './ImageStoreOptions.js';
import { SharpImageEncoder } from './SharpImageEncoder.js';
import { WebpValidatingEncoder } from './WebpValidatingEncoder.js';

/** Store options for the limits read from the environment. */
export function storeOptionsFor(limits: ImageLimits): ImageStoreOptions {
  return {
    encoder:
      limits.encodedBy === 'client'
        ? new WebpValidatingEncoder({
            maxDimension: limits.maxDimension,
            maxBytes: limits.maxUploadBytes,
          })
        : new SharpImageEncoder({ maxDimension: limits.maxDimension, quality: limits.quality }),
    quotaBytes: limits.quotaBytes,
    maxUploadBytes: limits.maxUploadBytes,
    encodedBy: limits.encodedBy,
    maxDimension: limits.maxDimension,
  };
}
