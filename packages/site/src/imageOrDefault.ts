import type { ImageDisplay } from '@metrack/domain';
import { imageSrc } from './imageSrc.js';
import { assetPath } from './sitePaths.js';

/** Where a cover loads from: the item's own, or the shared placeholder when it has none. */
export function coverSrc(ref: string | null, handle: string, display: ImageDisplay): string {
  return imageSrc(ref, handle, display) ?? assetPath('default-poster.webp');
}
