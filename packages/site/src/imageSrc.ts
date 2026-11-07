import { sizedImageUrl, type ImageDisplay } from '@metrack/domain';
import { imagePath } from './sitePaths.js';

const OWN_IMAGE = /^\/api\/images\/([0-9a-f]{64})$/;
const WEB_URL = /^https?:\/\//i;

/** The hash of a stored image reference, or null for anything else. */
export function ownImageHash(ref: string): string | null {
  return OWN_IMAGE.exec(ref)?.[1] ?? null;
}

/**
 * Where an anonymous visitor can load an image: stored images through the user's own public image
 * address, linked provider images at the size the display needs. Anything else is left out.
 */
export function imageSrc(
  ref: string | null,
  handle: string,
  display: ImageDisplay,
  origin = '',
): string | null {
  if (ref === null) return null;
  const hash = ownImageHash(ref);
  if (hash !== null) return `${origin}${imagePath(handle, hash)}`;
  return WEB_URL.test(ref) ? sizedImageUrl(ref, display) : null;
}
