/** What a route asks of the auth guard. A route that sets none needs a signed-in user. */
export interface RouteFlags {
  /** Answers without a session. Every other `/api` route needs one. */
  public?: boolean;
  /** Acts on the whole instance (backups, deleting shared images): only the owner may call it. */
  ownerOnly?: boolean;
  /** Needs the browser session: personal API tokens are refused (settings, managing tokens). */
  sessionOnly?: boolean;
  /** Adds items by hand: owner and trusted users only (`canAddByHand`). */
  trustedOnly?: boolean;
}
