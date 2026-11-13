import { formatSyncReport } from '../sync/formatSyncReport.js';
import type { Logger } from '../notify/Logger.js';
import type { SyncSources } from '../sync/SyncSources.js';
import { CloudClient } from './CloudClient.js';
import type { ConnectorConfig } from './ConnectorConfig.js';
import { describeRefreshes } from './describeRefreshes.js';
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
 * it the way a webhook does (re-planning on a 409, then refreshing the created titles and the ones without metadata). Returns the text to print.
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
  if (!options.apply) {
    return outcome.unfetched === 0
      ? report
      : `${report}\n\n${outcome.unfetched} titles have no metadata yet; sync asks for it`;
  }
  const applied = report.replace(
    '(nothing was written)',
    outcome.result ? '(applied)' : '(nothing to apply)',
  );
  const refreshes = describeRefreshes(outcome);
  return [
    applied,
    ...(outcome.result ? [`\nApplied: ${JSON.stringify(outcome.result)}`] : []),
    ...(refreshes ? [refreshes.replace(/^r/, 'R')] : []),
  ].join('\n');
}
