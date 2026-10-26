/** How recently a title was watched or played: whether it is in progress, and its latest tracked day. */
export interface Activity {
  active: boolean;
  last: string | null;
}
