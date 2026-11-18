export type SyncWarningCode =
  | 'dropped_with_plays'
  | 'season_number_conflict'
  | 'episode_count_mismatch'
  | 'specials_ignored'
  | 'episode_without_number';

export interface SyncWarning {
  code: SyncWarningCode;
  title: string;
  message: string;
}
