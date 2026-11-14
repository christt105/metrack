import { describe, expect, it } from 'vitest';
import { loadCloudBackupConfig } from '../src/cloudbackup/loadCloudBackupConfig.js';
import { loadConnectorConfig } from '../src/connector/loadConnectorConfig.js';

const d1 = {
  CLOUD_BACKUP_DIR: '/backups/cloud',
  CLOUDFLARE_ACCOUNT_ID: 'acct',
  CLOUD_BACKUP_D1_DATABASE_ID: 'db',
  CLOUD_BACKUP_D1_TOKEN: 'secret',
};

describe('loadCloudBackupConfig', () => {
  it('is off when nothing is set', () => {
    expect(loadCloudBackupConfig({})).toEqual({ config: undefined, missing: [] });
    expect(loadCloudBackupConfig({ CLOUDFLARE_ACCOUNT_ID: 'acct' }).config).toBeUndefined();
  });

  it('applies the defaults and copies only the database without a bucket', () => {
    expect(loadCloudBackupConfig(d1).config).toEqual({
      dir: '/backups/cloud',
      retention: 14,
      time: { hour: 4, minute: 30 },
      d1: { accountId: 'acct', databaseId: 'db', token: 'secret' },
      r2: undefined,
    });
  });

  it('reads the bucket, its keys, the endpoint, the retention and the time', () => {
    const { config } = loadCloudBackupConfig({
      ...d1,
      CLOUD_BACKUP_R2_BUCKET: 'metrack-images',
      CLOUD_BACKUP_R2_ACCESS_KEY_ID: 'key',
      CLOUD_BACKUP_R2_SECRET_ACCESS_KEY: 'sec',
      CLOUD_BACKUP_R2_ENDPOINT: 'http://minio:9000/',
      CLOUD_BACKUP_RETENTION: '7',
      CLOUD_BACKUP_TIME: '3:05',
    });
    expect(config?.r2).toEqual({
      bucket: 'metrack-images',
      accessKeyId: 'key',
      secretAccessKey: 'sec',
      endpoint: 'http://minio:9000',
    });
    expect(config).toMatchObject({ retention: 7, time: { hour: 3, minute: 5 } });
  });

  it('defaults the R2 endpoint to the account', () => {
    const { config } = loadCloudBackupConfig({
      ...d1,
      CLOUD_BACKUP_R2_BUCKET: 'b',
      CLOUD_BACKUP_R2_ACCESS_KEY_ID: 'k',
      CLOUD_BACKUP_R2_SECRET_ACCESS_KEY: 's',
    });
    expect(config?.r2?.endpoint).toBe('https://acct.r2.cloudflarestorage.com');
  });

  it('names the variables still needed when the setup is partial', () => {
    expect(loadCloudBackupConfig({ CLOUD_BACKUP_DIR: '/x' }).missing).toEqual([
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUD_BACKUP_D1_DATABASE_ID',
      'CLOUD_BACKUP_D1_TOKEN',
    ]);
    expect(loadCloudBackupConfig({ ...d1, CLOUD_BACKUP_R2_BUCKET: 'b' }).missing).toEqual([
      'CLOUD_BACKUP_R2_ACCESS_KEY_ID',
      'CLOUD_BACKUP_R2_SECRET_ACCESS_KEY',
    ]);
  });

  it('rejects an invalid retention or time', () => {
    expect(() => loadCloudBackupConfig({ ...d1, CLOUD_BACKUP_RETENTION: '0' })).toThrow(
      'RETENTION',
    );
    expect(() => loadCloudBackupConfig({ ...d1, CLOUD_BACKUP_TIME: '25:00' })).toThrow('TIME');
    expect(() => loadCloudBackupConfig({ ...d1, CLOUD_BACKUP_TIME: 'noon' })).toThrow('TIME');
  });

  it('makes the connector refuse a partial setup and carry a complete one', () => {
    const connector = {
      METRACK_URL: 'http://cloud.test',
      METRACK_CONNECTOR_TOKEN: 't',
      JELLYFIN_URL: 'http://jf',
      JELLYFIN_TOKEN: 't',
      JELLYSTAT_DB_HOST: 'h',
      JELLYSTAT_DB_PASSWORD: 'p',
    };
    expect(() => loadConnectorConfig({ ...connector, CLOUD_BACKUP_DIR: '/x' }, '/data')).toThrow(
      'partly configured',
    );
    expect(loadConnectorConfig({ ...connector, ...d1 }, '/data').config?.cloudBackup?.dir).toBe(
      '/backups/cloud',
    );
    expect(loadConnectorConfig(connector, '/data').config?.cloudBackup).toBeUndefined();
  });
});
