import type { ExportImage } from './ExportImage.js';
import { legacyImageName } from './legacyImageName.js';

/**
 * The file name of an image inside a page bundle. Images with a known source keep the name the old site gave
 * them, with a `.webp` extension when the stored copy was re-encoded.
 */
export function imageFileName(image: ExportImage): string {
  if (!image.sourceUrl) return `${image.hash}.${image.extension}`;
  const legacy = legacyImageName(image.sourceUrl);
  if (image.extension !== 'webp' || legacy.toLowerCase().endsWith('.webp')) return legacy;
  const dot = legacy.lastIndexOf('.');
  return `${dot < 0 ? legacy : legacy.slice(0, dot)}.webp`;
}
