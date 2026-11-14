import { setTimeout as sleep } from 'node:timers/promises';

const API = 'https://api.cloudflare.com/client/v4';

interface ExportEnvelope {
  success?: boolean;
  errors?: { message?: string }[];
  result?: {
    status?: string;
    error?: string;
    at_bookmark?: string;
    result?: { signed_url?: string };
  };
}

/**
 * Asks D1 for a SQL export of one database through the official export endpoint, polls until it is ready and
 * downloads it.
 */
export class D1Exporter {
  constructor(
    private readonly accountId: string,
    private readonly databaseId: string,
    private readonly token: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly pollMs = 2000,
    private readonly maxPolls = 150,
  ) {}

  /** Resolves to the SQL text of the whole database. */
  async export(): Promise<string> {
    let bookmark: string | undefined;
    for (let poll = 0; poll < this.maxPolls; poll += 1) {
      const result = await this.request(bookmark);
      if (result.status === 'complete') {
        const url = result.result?.signed_url;
        if (!url) throw new Error('D1 export finished without a download address');
        return this.download(url);
      }
      if (result.status === 'error') {
        throw new Error(`D1 export failed: ${result.error ?? 'unknown error'}`);
      }
      bookmark = result.at_bookmark ?? bookmark;
      await sleep(this.pollMs);
    }
    throw new Error(`D1 export did not finish after ${this.maxPolls} checks`);
  }

  private async request(
    bookmark: string | undefined,
  ): Promise<NonNullable<ExportEnvelope['result']>> {
    const response = await this.fetchFn(
      `${API}/accounts/${this.accountId}/d1/database/${this.databaseId}/export`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          output_format: 'polling',
          ...(bookmark ? { current_bookmark: bookmark } : {}),
        }),
      },
    );
    const body = (await response.json().catch(() => ({}))) as ExportEnvelope;
    if (!response.ok || body.success === false || !body.result) {
      const reason =
        body.errors?.map((error) => error.message).join('; ') || `HTTP ${response.status}`;
      throw new Error(`D1 export request failed: ${reason}`);
    }
    return body.result;
  }

  private async download(url: string): Promise<string> {
    const response = await this.fetchFn(url);
    if (!response.ok) throw new Error(`D1 export download failed: HTTP ${response.status}`);
    return response.text();
  }
}
