/** A user the home connector may sync, with the Jellyfin account in their settings. */
export interface ConnectorUser {
  id: number;
  name: string;
  jellyfinUser: string;
}
