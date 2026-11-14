/** The S256 PKCE challenge of a code verifier: the base64url SHA-256 of it. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString('base64url');
}
