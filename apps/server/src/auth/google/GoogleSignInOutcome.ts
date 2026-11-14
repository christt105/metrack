/** How a returning Google sign-in ended: a user to start a session for, no account for that Google account, or a failure. */
export type GoogleSignInOutcome =
  | { kind: 'signed-in'; userId: number }
  | { kind: 'no-account' }
  | { kind: 'failed'; reason: string };
