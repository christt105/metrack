import type { D1Database } from '../../src/storage/d1/D1Database.js';
import type { SqlValue } from '../../src/storage/mapping/SqlValue.js';

interface RestBody {
  sql?: string;
  params?: SqlValue[];
  batch?: { sql: string; params: SqlValue[] }[];
}

/**
 * A `fetch` that answers the D1 REST `query` endpoint over a local D1 and the S3 object calls over a map, with no
 * network. Every request is recorded, and `failDelete` makes the delete of some objects fail.
 */
export class FakeCloudflare {
  readonly objects = new Map<string, Uint8Array>();
  readonly requests: { method: string; url: string; body?: RestBody }[] = [];
  failDelete: (key: string) => boolean = () => false;

  constructor(private readonly db: D1Database) {}

  readonly fetch = (async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    if (url.hostname === 'api.cloudflare.com') return this.query(url, init);
    return this.object(url, method);
  }) as unknown as typeof fetch;

  private async query(url: URL, init?: RequestInit): Promise<Response> {
    const body = JSON.parse(String(init?.body)) as RestBody;
    this.requests.push({ method: 'POST', url: url.pathname, body });
    if (
      !url.pathname.endsWith('/d1/database/db1/query') ||
      !String(init?.headers && (init.headers as Record<string, string>).authorization).startsWith(
        'Bearer ',
      )
    ) {
      return Response.json(
        { success: false, errors: [{ message: 'bad request' }] },
        { status: 400 },
      );
    }
    const statements = body.batch ?? [{ sql: body.sql!, params: body.params ?? [] }];
    try {
      const results = await this.db.batch(
        statements.map((s) => this.db.prepare(s.sql).bind(...s.params)),
      );
      return Response.json({
        success: true,
        result: results.map((r) => ({ success: true, results: r.results, meta: r.meta })),
      });
    } catch (error) {
      return Response.json(
        { success: false, errors: [{ message: String(error) }] },
        { status: 400 },
      );
    }
  }

  private object(url: URL, method: string): Response {
    this.requests.push({ method, url: url.pathname });
    const key = decodeURIComponent(url.pathname.split('/').slice(2).join('/'));
    if (method === 'HEAD') return new Response(null, { status: this.objects.has(key) ? 200 : 404 });
    if (method === 'DELETE') {
      if (this.failDelete(key)) {
        return new Response('<Error><Code>InternalError</Code></Error>', { status: 500 });
      }
      this.objects.delete(key);
      return new Response(null, { status: 204 });
    }
    const bytes = this.objects.get(key);
    return bytes
      ? new Response(bytes as BodyInit)
      : new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 });
  }
}
