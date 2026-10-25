import type { ImageCandidate } from './ImageCandidate.js';

/** Candidates from every provider that answered, and the providers that did not. */
export interface ImageCandidateList {
  candidates: ImageCandidate[];
  failures: { provider: string; error: string }[];
}
