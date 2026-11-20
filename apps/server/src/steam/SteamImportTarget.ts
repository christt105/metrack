/** What applying one Steam game does, kept next to the row that shows it. */
export type SteamImportTarget =
  | { kind: 'update'; entryId: number; minutes: number }
  | { kind: 'catalog'; igdbId: number; title: string }
  | { kind: 'igdb'; igdbId: number };
