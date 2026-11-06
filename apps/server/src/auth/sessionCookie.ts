export const SESSION_COOKIE = 'metrack_session';

/** The `Set-Cookie` value that stores a session token. `Secure` is added when the request came over HTTPS. */
export function sessionCookie(token: string, expiresAt: Date, secure: boolean): string {
  return attributes(`${SESSION_COOKIE}=${token}; Expires=${expiresAt.toUTCString()}`, secure);
}

/** The `Set-Cookie` value that removes the session cookie. */
export function clearedSessionCookie(secure: boolean): string {
  return attributes(`${SESSION_COOKIE}=; Max-Age=0`, secure);
}

function attributes(cookie: string, secure: boolean): string {
  return `${cookie}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
