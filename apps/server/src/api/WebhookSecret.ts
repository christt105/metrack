import { createHash, timingSafeEqual } from 'node:crypto';

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

  matches(headers: Headers, url: URL): boolean {
    const presented =
      headers.get(WEBHOOK_SECRET_HEADER) ?? url.searchParams.get(WEBHOOK_SECRET_QUERY) ?? undefined;
    return presented !== undefined && timingSafeEqual(hash(presented), this.digest);
  }
}

function hash(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
