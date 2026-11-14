import type { D1Database } from '../storage/d1/D1Database.js';
import type { D1PreparedStatement } from '../storage/d1/D1PreparedStatement.js';
import type { D1Result } from '../storage/d1/D1Result.js';
import type { Row } from '../storage/mapping/Row.js';
import type { D1ExportConfig } from '../cloudbackup/D1ExportConfig.js';
import { RestD1PreparedStatement } from './RestD1PreparedStatement.js';
import type { RestStatement } from './RestStatement.js';

const API = 'https://api.cloudflare.com/client/v4';
/** D1 refuses a statement over 100 KB; a request is kept well under that. */
export const MAX_REQUEST_BYTES = 90_000;

interface QueryEnvelope {
  success?: boolean;
  errors?: { message?: string }[];
  result?: {
    success?: boolean;
    results?: Row[];
    meta?: { changes?: number; last_row_id?: number };
  }[];
}

/**
 * A D1 database reached through the Cloudflare REST API (`POST .../d1/database/{id}/query`), usable wherever the
 * Worker's binding is. A single statement is sent as `{ sql, params }` and a `batch` as `{ batch: [...] }`, which
 * D1 runs in order in one transaction like the binding's `batch`. A request over `MAX_REQUEST_BYTES` is refused
 * rather than split, because splitting would break that atomicity.
 */
export class RestD1Database implements D1Database {
  constructor(
    private readonly config: D1ExportConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  prepare(sql: string): D1PreparedStatement {
    return new RestD1PreparedStatement(this, sql);
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    if (statements.length === 0) return [];
    const bodies = statements.map((statement) => {
      if (!(statement instanceof RestD1PreparedStatement)) {
        throw new Error('A REST D1 batch only takes statements of the same database');
      }
      return statement.body;
    });
    return this.query(bodies, true);
  }

  /** Sends the statements and answers one result each, in order. */
  async query(statements: RestStatement[], batch: boolean): Promise<D1Result[]> {
    const body = JSON.stringify(batch ? { batch: statements } : statements[0]);
    if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) {
      throw new Error(`D1 request is too large: ${Buffer.byteLength(body)} bytes`);
    }
    const response = await this.fetchFn(
      `${API}/accounts/${this.config.accountId}/d1/database/${this.config.databaseId}/query`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.token}`,
          'content-type': 'application/json',
        },
        body,
      },
    );
    const envelope = (await response.json().catch(() => ({}))) as QueryEnvelope;
    const results = envelope.result;
    if (
      !response.ok ||
      envelope.success === false ||
      !results ||
      results.length !== statements.length ||
      results.some((result) => result.success === false)
    ) {
      const reason =
        envelope.errors?.map((error) => error.message).join('; ') || `HTTP ${response.status}`;
      throw new Error(`D1 query failed: ${reason}`);
    }
    return results.map((result) => ({
      results: result.results ?? [],
      meta: { changes: result.meta?.changes ?? 0, last_row_id: result.meta?.last_row_id ?? 0 },
    }));
  }
}
