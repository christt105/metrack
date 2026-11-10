import type { ImageUsage } from '@metrack/domain';

/** How the server wants uploads encoded, as reported by the image usage endpoint. */
export interface ImageSettings {
  imageEncoding: ImageUsage['imageEncoding'];
  maxDimension: number;
}
