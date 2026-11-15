/** The link a friend opens to join, on the address the app is served from. */
export function inviteUrl(origin: string, code: string): string {
  return `${origin}/invite/${code}`;
}
