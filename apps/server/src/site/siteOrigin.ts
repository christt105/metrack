function first(value: string | null): string | undefined {
  return value?.split(',')[0]?.trim() || undefined;
}

/** The address the feed links to: `PUBLIC_URL`, or else the address the visitor used. */
export function siteOrigin(request: Request, configured: string | null): string {
  if (configured) return configured.replace(/\/+$/, '');
  const url = new URL(request.url);
  const protocol = first(request.headers.get('x-forwarded-proto')) ?? url.protocol.slice(0, -1);
  const host =
    first(request.headers.get('x-forwarded-host')) ?? request.headers.get('host') ?? 'localhost';
  return `${protocol}://${host}`;
}
