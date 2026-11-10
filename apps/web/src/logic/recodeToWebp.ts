import { fitWithin } from './fitWithin';

export const DEFAULT_RECODE_MAX_SIDE = 1920;
export const RECODE_QUALITY = 0.82;

const WEBP = 'image/webp';

/**
 * Decodes an image in the browser and encodes it again as WebP at quality 0.82 with its longest side at most
 * `maxSide` px (1920 by default). Drops metadata and applies the EXIF orientation. Throws when the file cannot be decoded or the
 * browser cannot encode WebP.
 */
export async function recodeToWebp(
  file: Blob,
  maxSide: number = DEFAULT_RECODE_MAX_SIDE,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
    const blob = await encode(bitmap, width, height);
    if (blob.type !== WEBP) throw new Error('This browser cannot encode WebP images');
    return blob;
  } finally {
    bitmap.close();
  }
}

async function encode(bitmap: ImageBitmap, width: number, height: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: WEBP, quality: RECODE_QUALITY });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image'))),
      WEBP,
      RECODE_QUALITY,
    );
  });
}
