import type { SteamImportRow } from './SteamImportRow.js';
import type { SteamUnmatchedGame } from './SteamUnmatchedGame.js';

/** What importing the user's Steam library would do. Nothing is written until the user applies rows. */
export interface SteamImportReport {
  steamId: string;
  /** Games the Steam account owns. */
  owned: number;
  rows: SteamImportRow[];
  /** Games in the library whose stored time is already at least Steam's. */
  upToDate: number;
  unmatched: SteamUnmatchedGame[];
}
