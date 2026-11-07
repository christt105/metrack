import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

export const WEBHOOK_SECRET_HEADER = 'x-webhook-secret';
export const WEBHOOK_SECRET_QUERY = 'token';

/**
 * The shared secret a webhook sender must present, in the `X-Webhook-Secret` header or, for senders that cannot set
 * headers, the `token` query parameter. Compared in constant time.
 */
export class WebhookSecret {
  private readonly digest: Buffer;

  constructor(secret: string) {
    this.digest = hash(secret);
  }

  matches(request: FastifyRequest): boolean {
    const presented = fromHeader(request) ?? fromQuery(request);
    return presented !== undefined && timingSafeEqual(hash(presented), this.digest);
  }
}

function fromHeader(request: FastifyRequest): string | undefined {
  const value = request.headers[WEBHOOK_SECRET_HEADER];
  return typeof value === 'string' ? value : undefined;
}

function fromQuery(request: FastifyRequest): string | undefined {
  const query = request.query as Record<string, unknown> | undefined;
  const value = query?.[WEBHOOK_SECRET_QUERY];
  return typeof value === 'string' ? value : undefined;
}

function hash(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
