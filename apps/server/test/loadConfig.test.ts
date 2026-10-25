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

  it('defaults backups to daily with 14 kept under the data directory', () => {
    expect(loadConfig({ DATA_DIR: '/data' }).backup).toEqual({
      enabled: true,
      dir: '/data/backups',
      retention: 14,
      intervalHours: 24,
    });
  });

  it('reads backup settings and rejects invalid ones', () => {
    const config = loadConfig({
      BACKUP_RETENTION: '3',
      BACKUP_INTERVAL_HOURS: '6',
      BACKUP_ENABLED: 'false',
    });
    expect(config.backup).toMatchObject({ enabled: false, retention: 3, intervalHours: 6 });
    expect(() => loadConfig({ BACKUP_RETENTION: '0' })).toThrow('Invalid BACKUP_RETENTION');
    expect(loadConfig({ DATA_DIR: '/data', BACKUP_DIR: '/mnt/backups' }).backup.dir).toBe(
      '/mnt/backups',
    );
    expect(loadConfig({ DATA_DIR: '/data', BACKUP_DIR: '' }).backup.dir).toBe('/data/backups');
  });

  it('defaults release alerts to Madrid time from 8 and validates the hour', () => {
    expect(loadConfig({}).alerts).toEqual({
      enabled: true,
      timeZone: 'Europe/Madrid',
      notifyFromHour: 8,
    });
    expect(
      loadConfig({ ALERTS_ENABLED: 'false', ALERTS_TIMEZONE: 'UTC', ALERTS_NOTIFY_FROM_HOUR: '0' })
        .alerts,
    ).toEqual({ enabled: false, timeZone: 'UTC', notifyFromHour: 0 });
    expect(() => loadConfig({ ALERTS_NOTIFY_FROM_HOUR: '24' })).toThrow('ALERTS_NOTIFY_FROM_HOUR');
  });

  it('enables ntfy only when url and topic are both set', () => {
    expect(loadConfig({ NTFY_URL: 'http://x' }).ntfy).toBeUndefined();
    expect(loadConfig({ NTFY_URL: 'http://x', NTFY_TOPIC: 't', NTFY_TOKEN: 'k' }).ntfy).toEqual({
      url: 'http://x',
      topic: 't',
      token: 'k',
    });
  });
});
