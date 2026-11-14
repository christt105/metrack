/** How the connector sends release alerts to each user's own ntfy topic. */
export interface ReleaseAlertsConfig {
  /** The ntfy server the users' topics live on, without a token. */
  ntfyUrl: string;
  /** Local hour (Europe/Madrid) before which nothing is checked or sent. */
  notifyFromHour: number;
  /** Time between looks at which titles are due. */
  tickMs: number;
  /** Messages sent per UTC day before the connector stops, so it stays under the server's limit per IP. */
  dailyLimit: number;
}
