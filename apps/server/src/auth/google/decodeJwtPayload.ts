/** The claims of a JWT, read without checking its signature; undefined when it is not a JWT with a JSON object payload. */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | undefined {
  const parts = jwt.split('.');
  if (parts.length !== 3 || !parts[1]) return undefined;
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
