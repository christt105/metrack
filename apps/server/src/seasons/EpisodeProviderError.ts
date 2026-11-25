/** A call to the episode provider failed: it was unavailable, answered with an error, sent a bad document or went over the size limit. The original error is the `cause`. */
export class EpisodeProviderError extends Error {
  constructor(cause: unknown) {
    super('The episode provider failed', { cause });
    this.name = 'EpisodeProviderError';
  }
}
