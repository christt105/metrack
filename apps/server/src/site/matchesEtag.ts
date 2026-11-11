/** Whether an `If-None-Match` header lists the ETag (or is `*`). Weak validators match as well. */
export function matchesEtag(header: string | null, etag: string): boolean {
  if (header === null) return false;
  return header
    .split(',')
    .map((candidate) => candidate.trim().replace(/^W\//, ''))
    .some((candidate) => candidate === '*' || candidate === etag);
}
