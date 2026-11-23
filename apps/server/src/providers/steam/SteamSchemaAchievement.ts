/** One achievement of `ISteamUserStats/GetSchemaForGame`, with the icons Steam hosts for it. */
export interface SteamSchemaAchievement {
  name: string;
  displayName?: string;
  hidden?: number;
  description?: string;
  icon?: string;
  icongray?: string;
}
