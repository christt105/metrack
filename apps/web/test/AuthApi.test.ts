import { describe, expect, it } from 'vitest';
import { ApiClient } from '../src/api/ApiClient';
import { recorder } from './recordApi';

describe('AuthApi', () => {
  it('returns a degraded health report answered with 503', async () => {
    const report = {
      status: 'degraded',
      appVersion: 'dev',
      schemaVersion: 0,
      features: { backups: false, sync: false, googleLogin: false },
    };
    const { client } = recorder(new Response(JSON.stringify(report), { status: 503 }));
    expect(await client.auth.health()).toEqual(report);
  });

  it('maps a 204 to undefined and a thrown fetch to a network error', async () => {
    const { client } = recorder(new Response(null, { status: 204 }));
    expect(await client.remove('books', 1)).toBeUndefined();
    const broken = new ApiClient((async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch);
    await expect(broken.auth.health()).rejects.toMatchObject({ code: 'network_error', status: 0 });
  });
});
