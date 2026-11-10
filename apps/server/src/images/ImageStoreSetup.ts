import type { ImageEncoder } from './ImageEncoder.js';
import type { ImageStoreOptions } from './ImageStoreOptions.js';
import type { UrlGuard } from './UrlGuard.js';

/** Everything an image store needs, with the encoder and the URL guard chosen by whoever builds it. */
export type ImageStoreSetup = ImageStoreOptions & { encoder: ImageEncoder; urlGuard: UrlGuard };
