/**
 * The token in an `Authorization: Bearer <token>` header; undefined without the header, and an
 * empty string when the header is there but is not a bearer token, so it can be refused.
 */
export function readBearerToken(header: string | undefined): string | undefined {
  if (header === undefined) return undefined;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1] ?? '';
}
