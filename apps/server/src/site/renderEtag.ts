/** The strong validator of one page at one content version of one user. */
export function renderEtag(userId: number, version: number, cacheKey: string): string {
  return `"${userId}.${version}.${cacheKey}"`;
}
