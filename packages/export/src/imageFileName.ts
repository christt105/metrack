import type { ExportImage } from './ExportImage.js';
import { legacyImageName } from './legacyImageName.js';

/** The file name of an image inside a page bundle. Images with a known source keep the name the old site gave them. */
export function imageFileName(image: ExportImage): string {
  return image.sourceUrl ? legacyImageName(image.sourceUrl) : `${image.hash}.${image.extension}`;
}
