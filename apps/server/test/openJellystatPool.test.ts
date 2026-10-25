import { describe, expect, it } from 'vitest';
import { openJellystatPool } from '../src/sync/jellystat/openJellystatPool.js';

describe('openJellystatPool', () => {
  it('logs errors from idle connections instead of crashing', async () => {
    const errors: string[] = [];
    const pool = openJellystatPool(
      { host: '127.0.0.1', port: 5432, user: 'u', password: 'p', database: 'jfstat' },
      { info: () => {}, error: (message) => errors.push(message) },
    );
    try {
      expect(() => pool.emit('error', new Error('terminating connection'))).not.toThrow();
      expect(errors).toEqual(['Jellystat connection error: terminating connection']);
    } finally {
      await pool.end();
    }
  });
});
