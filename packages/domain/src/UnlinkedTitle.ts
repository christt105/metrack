import type { MediaType } from './MediaType.js';

/** A title that arrived without any external id and waits for manual linking. */
export interface UnlinkedTitle {
  id: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  source: string;
  sourceRef: string | null;
  createdAt: string;
}
