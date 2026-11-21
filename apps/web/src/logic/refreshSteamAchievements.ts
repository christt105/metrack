import type { SteamAchievementsRequest, SteamAchievementsResponse } from '@metrack/domain';

/** What a whole pass of achievement checks did. */
export interface AchievementsPass {
  processed: number;
  failed: number;
  remaining: number;
}

/**
 * Asks the server to check the achievements of the user's Steam games, one batch per request, until none remain,
 * sending back the `asOf` the first answer returned so the pass ends. `onProgress` gets the games checked so far and
 * the games the pass has in all. Stops without failing when a request checks nothing.
 */
export async function refreshSteamAchievements(
  send: (request: SteamAchievementsRequest) => Promise<SteamAchievementsResponse>,
  onProgress: (done: number, total: number) => void = () => {},
): Promise<AchievementsPass> {
  let asOf: string | undefined;
  let processed = 0;
  let failed = 0;
  let total = 0;
  for (;;) {
    const answer = await send(asOf === undefined ? {} : { asOf });
    asOf = answer.asOf;
    processed += answer.processed;
    failed += answer.failed;
    total = Math.max(total, processed + answer.remaining);
    onProgress(processed, total);
    if (answer.remaining === 0 || answer.processed === 0) {
      return { processed, failed, remaining: answer.remaining };
    }
  }
}
