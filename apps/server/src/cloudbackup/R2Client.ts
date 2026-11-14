import type { R2Config } from './R2Config.js';
import type { R2Object } from './R2Object.js';
import { signAwsRequest } from './signAwsRequest.js';

const REGION = 'auto';
const SERVICE = 's3';

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** A read-only client for one bucket of the S3 API of R2: listing and getting objects. */
export class R2Client {
  constructor(
    private readonly config: R2Config,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Every object of the bucket, following the continuation tokens. */
  async list(): Promise<R2Object[]> {
    const objects: R2Object[] = [];
    let token: string | undefined;
    do {
      const url = this.url('');
      url.searchParams.set('list-type', '2');
      if (token) url.searchParams.set('continuation-token', token);
      const xml = await (await this.send(url)).text();
      for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const key = /<Key>([\s\S]*?)<\/Key>/.exec(match[1]!)?.[1];
        const size = /<Size>(\d+)<\/Size>/.exec(match[1]!)?.[1];
        if (key !== undefined) objects.push({ key: decodeXml(key), size: Number(size ?? 0) });
      }
      const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
      const next = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1];
      if (truncated && !next)
        throw new Error('R2 listing is truncated without a continuation token');
      token = truncated ? decodeXml(next!) : undefined;
    } while (token);
    return objects;
  }

  /** The bytes of one object. */
  async get(key: string): Promise<Buffer> {
    const response = await this.send(
      this.url(`/${key.split('/').map(encodeURIComponent).join('/')}`),
    );
    return Buffer.from(await response.arrayBuffer());
  }

  private url(path: string): URL {
    return new URL(`${this.config.endpoint}/${encodeURIComponent(this.config.bucket)}${path}`);
  }

  private async send(url: URL): Promise<Response> {
    const headers = signAwsRequest({
      method: 'GET',
      url,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: REGION,
      service: SERVICE,
      date: this.now(),
    });
    const response = await this.fetchFn(url, { headers });
    if (!response.ok) {
      const detail = /<Code>([\s\S]*?)<\/Code>/.exec(await response.text())?.[1];
      throw new Error(`R2 request failed: HTTP ${response.status}${detail ? ` ${detail}` : ''}`);
    }
    return response;
  }
}
