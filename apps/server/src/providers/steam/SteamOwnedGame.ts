/** A game of a Steam account as `IPlayerService/GetOwnedGames` reports it. */
export interface SteamOwnedGame {
  appid: number;
  name?: string;
  playtime_forever?: number;
  playtime_2weeks?: number;
  rtime_last_played?: number;
}
