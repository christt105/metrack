import { describe, expect, it } from 'vitest';
import { createHealthReport } from '../src/index.js';

describe('createHealthReport', () => {
  it('reports ok once a migration has been applied', () => {
    expect(createHealthReport('1.2.3', 1, { backups: true })).toEqual({
      status: 'ok',
      appVersion: '1.2.3',
      schemaVersion: 1,
      features: { backups: true },
    });
  });

  it('reports degraded when the schema is empty', () => {
    expect(createHealthReport('1.2.3', 0, { backups: false }).status).toBe('degraded');
  });
});
