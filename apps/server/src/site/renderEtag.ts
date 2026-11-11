/** The strong validator of one stored render: the user, the content version, when it was rendered and the page. */
export function renderEtag(
  userId: number,
  version: number,
  renderedAt: number,
  cacheKey: string,
): string {
  return `"${userId}.${version}.${renderedAt}.${cacheKey}"`;
}
