import { STEAM_APPLY_BATCH_SIZE, type SteamApplyResponse } from '@metrack/domain';
import type { SteamApplyProgress } from './SteamApplyProgress';
import type { SteamApplyTally } from './SteamApplyTally';

/**
 * Sends the chosen Steam app ids in batches and keeps going until every one has an outcome. The server may defer part
 * of a batch to stay inside its limits; those ids go first in the next request. A request that fails stops the import,
 * and what was written before it stays written.
 */
export async function applySteamRows(
  appIds: readonly string[],
  send: (batch: string[]) => Promise<SteamApplyResponse>,
  onProgress: (progress: SteamApplyProgress) => void = () => {},
): Promise<SteamApplyTally> {
  const tally: SteamApplyTally = { updated: 0, imported: 0, skipped: 0, failed: [] };
  const queue = [...new Set(appIds)];
  const total = queue.length;
  let done = 0;
  onProgress({ done, total });
  while (queue.length > 0) {
    const batch = queue.splice(0, STEAM_APPLY_BATCH_SIZE);
    const { outcomes } = await send(batch);
    const deferred: string[] = [];
    for (const outcome of outcomes) {
      if (outcome.result === 'deferred') deferred.push(outcome.appId);
      else if (outcome.result === 'failed') tally.failed.push(outcome);
      else tally[outcome.result] += 1;
    }
    const answered = new Set(outcomes.map((outcome) => outcome.appId));
    done += outcomes.length - deferred.length;
    for (const appId of batch) if (!answered.has(appId)) deferred.push(appId);
    queue.unshift(...deferred);
    if (deferred.length === batch.length && outcomes.every((o) => o.result === 'deferred')) {
      throw new Error('The server made no progress on this import');
    }
    onProgress({ done: Math.min(done, total), total });
  }
  return tally;
}
