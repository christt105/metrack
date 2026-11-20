/** The part of a game in the user's library that the import compares with Steam. */
export interface SteamLibraryEntry {
  id: number;
  steamAppId: string | null;
  igdbId: number | null;
  timeSpentMinutes: number | null;
}
