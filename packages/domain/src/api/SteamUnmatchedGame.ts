/** A Steam game that is not in the library and that IGDB does not know by its Steam app id. */
export interface SteamUnmatchedGame {
  appId: string;
  name: string;
  playtimeMinutes: number;
}
