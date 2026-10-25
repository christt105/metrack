/** The subset of a Jellyfin item this service reads. */
export interface JellyfinItem {
  Id: string;
  Name?: string;
  Type?: string;
  ProductionYear?: number;
  PremiereDate?: string | null;
  RunTimeTicks?: number | null;
  IndexNumber?: number | null;
  ParentIndexNumber?: number | null;
  SeasonId?: string;
  LocationType?: string;
  ProviderIds?: Record<string, string>;
}
