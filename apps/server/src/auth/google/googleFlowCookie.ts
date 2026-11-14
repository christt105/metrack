export const GOOGLE_FLOW_COOKIE = 'metrack_google_flow';
export const GOOGLE_FLOW_PATH = '/api/auth/google';
export const GOOGLE_FLOW_TTL_SECONDS = 600;

/** The `Set-Cookie` value that keeps the sign-in flow's secrets in the browser until Google sends it back. */
export function googleFlowCookie(value: string, secure: boolean): string {
  return attributes(`${GOOGLE_FLOW_COOKIE}=${value}; Max-Age=${GOOGLE_FLOW_TTL_SECONDS}`, secure);
}

/** The `Set-Cookie` value that removes the flow cookie. */
export function clearedGoogleFlowCookie(secure: boolean): string {
  return attributes(`${GOOGLE_FLOW_COOKIE}=; Max-Age=0`, secure);
}

function attributes(cookie: string, secure: boolean): string {
  return `${cookie}; Path=${GOOGLE_FLOW_PATH}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
