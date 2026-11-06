/** A sign-in session as stored: `id` is the SHA-256 of the token the browser holds, never the token. */
export interface StoredSession {
  id: string;
  userId: number;
  createdAt: string;
  expiresAt: string;
}
