import type { ImageCandidate, ImageKind, MediaType } from '@metrack/domain';
import type { ImageSubject } from './ImageSubject.js';

/** A source of cover and banner candidates. It also decides which image URLs the server may download. */
export interface ImageProvider {
  readonly name: string;
  supports(type: MediaType, kind: ImageKind): boolean;
  candidates(subject: ImageSubject, kind: ImageKind): Promise<ImageCandidate[]>;
  owns(url: string): boolean;
}
