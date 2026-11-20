import type { MediaStatus } from '../MediaStatus.js';

/** One Steam game the import report proposes to write. */
export interface SteamImportRow {
  appId: string;
  name: string;
  /** Total minutes Steam reports for the game. */
  playtimeMinutes: number;
  /** Minutes played in the last two weeks. */
  recentMinutes: number;
  /** When Steam last saw the game played, as an ISO timestamp; null when never. */
  lastPlayedAt: string | null;
  /** `update` raises the time of a game already in the library; `import` adds a game to it. */
  action: 'update' | 'import';
  /** Where an imported game was found: the shared catalog or IGDB. */
  source: 'library' | 'catalog' | 'igdb';
  /** The time stored for a game already in the library; null when none or when the game is new. */
  storedMinutes: number | null;
  /** The status an imported game gets; null for an update, which leaves the status alone. */
  status: MediaStatus | null;
  /** Whether the row starts selected in the report. */
  selected: boolean;
}
