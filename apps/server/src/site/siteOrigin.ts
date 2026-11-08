import type { FastifyRequest } from 'fastify';

function first(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim() || undefined;
}

/** The address the feed links to: `PUBLIC_URL`, or else the address the visitor used. */
export function siteOrigin(request: FastifyRequest, configured: string | null): string {
  if (configured) return configured.replace(/\/+$/, '');
  const protocol = first(request.headers['x-forwarded-proto']) ?? request.protocol;
  const host = first(request.headers['x-forwarded-host']) ?? request.headers.host ?? 'localhost';
  return `${protocol}://${host}`;
}
