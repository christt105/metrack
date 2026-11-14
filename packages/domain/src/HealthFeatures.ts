/** Optional server capabilities the web client adapts to. */
export interface HealthFeatures {
  backups: boolean;
  /** Whether this server reads Jellyfin itself; when false, a home connector does the syncing. */
  sync: boolean;
  /** Whether "Sign in with Google" is set up. */
  googleLogin: boolean;
}
