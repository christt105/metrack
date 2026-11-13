import { formatSyncReport } from '../sync/formatSyncReport.js';
import type { Logger } from '../notify/Logger.js';
import type { SyncSources } from '../sync/SyncSources.js';
import { CloudClient } from './CloudClient.js';
import type { ConnectorConfig } from './ConnectorConfig.js';
import { findConnectorUser } from './findConnectorUser.js';
import { UserSync } from './UserSync.js';

export interface ConnectorCommandOptions {
  /** The user to sync: id, name or Jellyfin account. */
  user: string;
  apply: boolean;
  verbose: boolean;
}

/**
 * One sync of one user, for the command line: `report` computes the plan and writes nothing, `sync` also applies
 * it the way a webhook does (re-planning on a 409, then refreshing the created titles). Returns the text to print.
 */
export async function runConnectorCommand(
  config: ConnectorConfig,
  sources: (jellyfinUser: string) => SyncSources,
  options: ConnectorCommandOptions,
  logger: Logger,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const cloud = new CloudClient(config.cloudUrl, config.token, fetchFn);
  const user = findConnectorUser(await cloud.users(), options.user);
  if (!user) {
    throw new Error(`No user matches "${options.user}" among the ones with a Jellyfin account`);
  }
  const outcome = await new UserSync(cloud, sources, config.sync.timeZone, logger).run(
    user,
    options.apply,
  );
  const report = formatSyncReport(outcome.plan, options.verbose);
  if (!options.apply) return report;
  const applied = report.replace(
    '(nothing was written)',
    outcome.result ? '(applied)' : '(nothing to apply)',
  );
  return outcome.result
    ? `${applied}\n\nApplied: ${JSON.stringify(outcome.result)}\nRefreshed ${outcome.refreshed} of ${outcome.created} created titles`
    : applied;
}
