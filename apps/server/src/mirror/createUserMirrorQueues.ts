import { DEFAULT_QUEUE_OPTIONS, PublishQueue } from '../publish/PublishQueue.js';
import { userDataPath } from '../users/userDataPath.js';
import { UserQueues } from '../users/UserQueues.js';
import { describeMirrorResult } from './describeMirrorResult.js';
import { syncVaultMirror } from './syncVaultMirror.js';
import type { UserMirrorDeps } from './UserMirrorDeps.js';

/** Mirrors the notes of every user with a vault folder into that folder, each with its own record of what it wrote. */
export function createUserMirrorQueues(deps: UserMirrorDeps): UserQueues {
  return new UserQueues(
    () => deps.jobs.usersWith((settings) => settings.mirrorDir),
    (userId) =>
      new PublishQueue(
        () => mirrorAs(deps, userId),
        deps.jobs.notifier(userId),
        deps.jobs.logger(userId),
        deps.jobs.scheduler(userId),
        { ...DEFAULT_QUEUE_OPTIONS, label: 'vault mirror' },
      ),
  );
}

async function mirrorAs(deps: UserMirrorDeps, userId: number): Promise<string> {
  const settings = await deps.jobs.settings.get(userId);
  const mirrorDir = settings?.mirrorDir;
  if (!mirrorDir) return 'skipped, no vault folder is set';
  return describeMirrorResult(
    await syncVaultMirror(deps.sources, {
      mirrorDir,
      linkPrefix: settings.mirrorLinkPrefix ?? 'Media Tracker',
      webUrl: deps.webUrl,
      statePath: userDataPath(deps.dataDir, userId, 'vault-mirror-state.json'),
      apply: true,
    }),
  );
}
