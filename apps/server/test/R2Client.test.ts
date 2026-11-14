import { describe, expect, it } from 'vitest';
import { R2Client } from '../src/cloudbackup/R2Client.js';

const config = {
  bucket: 'metrack-images',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  endpoint: 'https://acct.r2.cloudflarestorage.com',
};

function page(keys: [string, number][], next?: string): Response {
  const contents = keys
    .map(([key, size]) => `<Contents><Key>${key}</Key><Size>${size}</Size></Contents>`)
    .join('');
  return new Response(
    `<ListBucketResult><IsTruncated>${next ? 'true' : 'false'}</IsTruncated>${contents}${
      next ? `<NextContinuationToken>${next}</NextContinuationToken>` : ''
    }</ListBucketResult>`,
  );
}

describe('R2Client', () => {
  it('lists every page, passing the continuation token and signing each request', async () => {
    const urls: string[] = [];
    const auth: string[] = [];
    const answers = [page([['a.webp', 1]], 'tok=/+'), page([['b&c.webp', 2]])];
    const client = new R2Client(config, (async (input: URL, init: RequestInit) => {
      urls.push(String(input));
      auth.push((init.headers as Record<string, string>).authorization!);
      return answers.shift()!;
    }) as unknown as typeof fetch);
    expect(await client.list()).toEqual([
      { key: 'a.webp', size: 1 },
      { key: 'b&c.webp', size: 2 },
    ]);
    expect(urls).toEqual([
      'https://acct.r2.cloudflarestorage.com/metrack-images?list-type=2',
      'https://acct.r2.cloudflarestorage.com/metrack-images?list-type=2&continuation-token=tok%3D%2F%2B',
    ]);
    expect(auth[0]).toMatch(/^AWS4-HMAC-SHA256 Credential=key\/\d{8}\/auto\/s3\/aws4_request/);
  });

  it('lists an empty bucket', async () => {
    const client = new R2Client(config, (async () => page([])) as unknown as typeof fetch);
    expect(await client.list()).toEqual([]);
  });

  it('gets an object and fails with the S3 error code', async () => {
    const client = new R2Client(config, (async (input: URL) =>
      String(input).endsWith('/ok.webp')
        ? new Response('bytes')
        : new Response('<Error><Code>AccessDenied</Code></Error>', {
            status: 403,
          })) as unknown as typeof fetch);
    expect((await client.get('ok.webp')).toString()).toBe('bytes');
    await expect(client.get('no.webp')).rejects.toThrow('HTTP 403 AccessDenied');
  });

  it('probes objects with HEAD and treats a 404 as missing', async () => {
    const seen: string[] = [];
    const client = new R2Client(config, (async (input: URL, init: RequestInit) => {
      seen.push(`${init.method} ${input.pathname}`);
      if (String(input).endsWith('/gone.webp')) return new Response(null, { status: 404 });
      if (String(input).endsWith('/denied.webp')) return new Response(null, { status: 403 });
      return new Response(null);
    }) as unknown as typeof fetch);
    expect(await client.has('here.webp')).toBe(true);
    expect(await client.has('gone.webp')).toBe(false);
    await expect(client.has('denied.webp')).rejects.toThrow('HTTP 403');
    expect(seen[0]).toBe('HEAD /metrack-images/here.webp');
  });

  it('deletes an object with a signed DELETE and fails with the S3 error code', async () => {
    const seen: { method: string; auth: string }[] = [];
    const client = new R2Client(config, (async (input: URL, init: RequestInit) => {
      seen.push({
        method: init.method!,
        auth: (init.headers as Record<string, string>).authorization!,
      });
      return String(input).endsWith('/no.webp')
        ? new Response('<Error><Code>AccessDenied</Code></Error>', { status: 403 })
        : new Response(null, { status: 204 });
    }) as unknown as typeof fetch);
    await client.delete('ok.webp');
    expect(seen[0]!.method).toBe('DELETE');
    expect(seen[0]!.auth).toMatch(/^AWS4-HMAC-SHA256 Credential=key\//);
    await expect(client.delete('no.webp')).rejects.toThrow('HTTP 403 AccessDenied');
  });
});
