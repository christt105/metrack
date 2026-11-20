import type { SteamArtworkResponse } from '@metrack/domain';

/**
 * Asks the server to prepare the artwork of the imported games until none are left, telling how many remain after each
 * request. Stops early, without failing, when a request finishes nothing, since the server also finishes leftovers on
 * its own schedule. Answers how many games were still waiting when it stopped.
 */
export async function prepareSteamArtwork(
  send: () => Promise<SteamArtworkResponse>,
  onRemaining: (remaining: number) => void = () => {},
): Promise<number> {
  for (;;) {
    const { processed, remaining } = await send();
    onRemaining(remaining);
    if (remaining === 0 || processed === 0) return remaining;
  }
}
