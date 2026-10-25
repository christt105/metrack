export interface JellyfinConfig {
  url: string;
  token: string;
  /** Account whose watched state is read; without it items carry no per-user data. */
  userName?: string;
}
