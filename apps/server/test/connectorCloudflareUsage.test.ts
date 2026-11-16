import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConnectorConfig } from '../src/connector/loadConnectorConfig.js';
import { runConnector } from '../src/connector/runConnector.js';
import type { SyncSources } from '../src/sync/SyncSources.js';

const BASE_ENV = {
  METRACK_URL: 'http://cloud.test',
  METRACK_CONNECTOR_TOKEN: 'connector-token',
  JELLYFIN_URL: 'http://jf.test',
  JELLYFIN_TOKEN: 'jf-token',
  JELLYSTAT_DB_HOST: 'db.test',
  JELLYSTAT_DB_PASSWORD: 'secret',
};
const USAGE_ENV = { CLOUDFLARE_USAGE_TOKEN: 'tok_secret', CLOUDFLARE_ACCOUNT_ID: 'abc123' };
const NTFY = { url: 'http://ntfy.test', topic: 'servidor' };

function start(env: Record<string, string | undefined>, withNtfy = true) {
  const dataDir = mkdtempSync(join(tmpdir(), 'connector-usage-'));
  const { config } = loadConnectorConfig({ ...BASE_ENV, CONNECTOR_DATA_DIR: dataDir }, dataDir);
  const logs: string[] = [];
  const logger = { info: (m: string) => logs.push(m), error: (m: string) => logs.push(m) };
  const stop = runConnector(
    config!,
    { port: 0, host: '127.0.0.1', ntfy: withNtfy ? NTFY : undefined },
    () => ({}) as SyncSources,
    logger,
    undefined,
    env,
  );
  return { stop, logs };
}

async function usageCalls(fetchMock: ReturnType<typeof vi.fn>): Promise<unknown[][]> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('api.cloudflare.com'));
}

describe('connector Cloudflare usage alerts', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch() {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('starts the usage scheduler when the token, the account id and ntfy are set', async () => {
    const fetchMock = stubFetch();
    const { stop, logs } = start({
      ...USAGE_ENV,
      CLOUDFLARE_USAGE_WARN_PERCENT: '60',
      CLOUDFLARE_USAGE_CRITICAL_PERCENT: '80',
    });
    try {
      const calls = await usageCalls(fetchMock);
      expect(calls.length).toBeGreaterThan(0);
      const line = logs.find((message) => message.startsWith('cloudflare usage alerts on'));
      expect(line).toContain('warning at 60%');
      expect(line).toContain('critical at 80%');
      expect(logs.join('\n')).not.toContain('tok_secret');
    } finally {
      stop();
    }
  });

  it('does not start it without the token', async () => {
    const fetchMock = stubFetch();
    const { stop, logs } = start({ CLOUDFLARE_ACCOUNT_ID: 'abc123' });
    try {
      expect(await usageCalls(fetchMock)).toHaveLength(0);
      expect(logs.some((message) => message.includes('usage alerts on'))).toBe(false);
    } finally {
      stop();
    }
  });

  it('does not start it without ntfy and says so', async () => {
    const fetchMock = stubFetch();
    const { stop, logs } = start(USAGE_ENV, false);
    try {
      expect(await usageCalls(fetchMock)).toHaveLength(0);
      expect(logs.some((message) => message.includes('Cloudflare usage alerts are off'))).toBe(
        true,
      );
    } finally {
      stop();
    }
  });
});
