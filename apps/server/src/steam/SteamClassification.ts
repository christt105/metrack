import type { SteamImportReport } from '@metrack/domain';
import type { SteamImportTarget } from './SteamImportTarget.js';

/** The report and, for each importable or updatable app id, what applying it does. */
export interface SteamClassification {
  report: Omit<SteamImportReport, 'steamId'>;
  targets: Map<string, SteamImportTarget>;
}
