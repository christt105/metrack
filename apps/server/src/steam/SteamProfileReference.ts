/** What a typed Steam profile points at: an account id already, or a vanity name that Steam has to resolve. */
export type SteamProfileReference =
  { kind: 'id'; steamId: string } | { kind: 'vanity'; name: string };
