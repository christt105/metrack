import { describe, expect, it } from 'vitest';
import { D1Exporter } from '../src/cloudbackup/D1Exporter.js';

const URL_EXPORT = 'https://api.cloudflare.com/client/v4/accounts/acct/d1/database/db/export';

interface Call {
  url: string;
  body?: Record<string, unknown>;
  authorization?: string;
}

function scripted(answers: Response[]): { fetchFn: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchFn = (async (input: string | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      authorization: (init?.headers as Record<string, string> | undefined)?.authorization,
    });
    return answers.shift()!;
  }) as typeof fetch;
  return { fetchFn, calls };
}

const active = (bookmark: string) =>
  Response.json({ success: true, result: { status: 'active', at_bookmark: bookmark } });

describe('D1Exporter', () => {
  it('starts the export, polls with the bookmark and downloads the SQL', async () => {
    const { fetchFn, calls } = scripted([
      active('b1'),
      active('b1'),
      Response.json({
        success: true,
        result: { status: 'complete', result: { signed_url: 'https://r2.test/dump.sql' } },
      }),
      new Response('CREATE TABLE t (a);'),
    ]);
    const sql = await new D1Exporter('acct', 'db', 'secret', fetchFn, 0).export();
    expect(sql).toBe('CREATE TABLE t (a);');
    expect(calls.map((call) => call.url)).toEqual([
      URL_EXPORT,
      URL_EXPORT,
      URL_EXPORT,
      'https://r2.test/dump.sql',
    ]);
    expect(calls[0]!.body).toEqual({ output_format: 'polling' });
    expect(calls[1]!.body).toEqual({ output_format: 'polling', current_bookmark: 'b1' });
    expect(calls[0]!.authorization).toBe('Bearer secret');
    expect(calls[3]!.authorization).toBeUndefined();
  });

  it('reports the API errors', async () => {
    const { fetchFn } = scripted([
      Response.json(
        { success: false, errors: [{ message: 'Authentication error' }] },
        { status: 403 },
      ),
    ]);
    await expect(new D1Exporter('acct', 'db', 't', fetchFn, 0).export()).rejects.toThrow(
      'Authentication error',
    );
  });

  it('fails when the export reports an error', async () => {
    const { fetchFn } = scripted([
      Response.json({ success: true, result: { status: 'error', error: 'too big' } }),
    ]);
    await expect(new D1Exporter('acct', 'db', 't', fetchFn, 0).export()).rejects.toThrow('too big');
  });

  it('gives up after the maximum number of checks', async () => {
    const { fetchFn } = scripted([active('b'), active('b'), active('b')]);
    await expect(new D1Exporter('acct', 'db', 't', fetchFn, 0, 3).export()).rejects.toThrow(
      'did not finish',
    );
  });

  it('fails when the download is refused', async () => {
    const { fetchFn } = scripted([
      Response.json({
        success: true,
        result: { status: 'complete', result: { signed_url: 'https://r2.test/x' } },
      }),
      new Response('no', { status: 403 }),
    ]);
    await expect(new D1Exporter('acct', 'db', 't', fetchFn, 0).export()).rejects.toThrow(
      'download failed: HTTP 403',
    );
  });
});
