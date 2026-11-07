import type { ImageUsage } from './ImageUsage.js';

/** Body of `POST /api/images`: the stored image, already re-encoded, and the uploader's quota after it. */
export interface UploadedImage {
  ref: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  usage: ImageUsage;
}
