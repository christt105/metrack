import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/loadConfig.js';

describe('loadConfig', () => {
  it('defaults to port 8097', () => {
    expect(loadConfig({}).port).toBe(8097);
  });

  it('reads PORT from the environment', () => {
    expect(loadConfig({ PORT: '9000' }).port).toBe(9000);
  });

  it('rejects an invalid PORT', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow('Invalid PORT');
  });
});
