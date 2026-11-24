import { EpisodeProviderError } from './EpisodeProviderError.js';

/** Runs a provider call, turning whatever it throws into an `EpisodeProviderError` so it is not mistaken for a storage failure. */
export async function fromProvider<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw new EpisodeProviderError(error);
  }
}
