/**
 * How a Google sign-in ended: a user to start a session for, no account for that Google account, an invitation
 * that could not be used (expired, revoked or used up) so nothing was created, or a failure.
 */
export type GoogleSignInOutcome =
  | { kind: 'signed-in'; userId: number }
  | { kind: 'no-account' }
  | { kind: 'invite-unusable'; code: string }
  | { kind: 'failed'; reason: string };
