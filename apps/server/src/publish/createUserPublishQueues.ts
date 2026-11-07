import { userDataPath } from '../users/userDataPath.js';
import { UserQueues } from '../users/UserQueues.js';
import { CloudflarePagesPublisher } from './CloudflarePagesPublisher.js';
import { FilePublishState } from './FilePublishState.js';
import { PublishPipeline } from './PublishPipeline.js';
import { PublishQueue } from './PublishQueue.js';
import type { UserPublishDeps } from './UserPublishDeps.js';

/**
 * Publishes the site of every user with a Cloudflare Pages project, each from their own data into their own
 * project, with its own work folder and record of what is online.
 */
export function createUserPublishQueues(deps: UserPublishDeps): UserQueues {
  return new UserQueues(
    () => deps.jobs.usersWith((settings) => settings.publishProject),
    (userId) =>
      new PublishQueue(
        () => publishAs(deps, userId),
        deps.jobs.notifier(userId),
        deps.jobs.logger(userId),
        deps.jobs.scheduler(userId),
      ),
  );
}

async function publishAs(deps: UserPublishDeps, userId: number): Promise<string> {
  const settings = await deps.jobs.settings.get(userId);
  const project = settings?.publishProject;
  if (!project) return 'skipped, no Cloudflare Pages project is set';
  const pipeline = new PublishPipeline(
    deps.sources,
    {
      siteTemplateDir: deps.config.siteTemplateDir,
      workDir: userDataPath(deps.dataDir, userId, 'publish'),
      hugoBinary: deps.config.hugoBinary,
      baseUrl: settings.publishBaseUrl ?? undefined,
    },
    deps.runner,
    new CloudflarePagesPublisher({ ...deps.config, cloudflareProject: project }, deps.runner),
    new FilePublishState(userDataPath(deps.dataDir, userId, 'publish-state.json')),
  );
  return pipeline.run();
}
