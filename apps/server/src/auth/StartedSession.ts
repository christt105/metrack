export interface StartedSession {
  /** Goes to the browser once, in the session cookie; it is not stored. */
  token: string;
  expiresAt: Date;
}
