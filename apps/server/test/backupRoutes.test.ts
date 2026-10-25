import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/api/buildApp.js';
import { BackupJob } from '../src/backup/BackupJob.js';
import { BackupService } from '../src/backup/BackupService.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { openDatabase } from '../src/storage/openDatabase.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'metrack-routes-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('backup routes', () => {
  it('creates and lists backups', async () => {
    const db = openDatabase(join(dir, 'metrack.db'));
    const runner = new MigrationRunner(db, migrations);
    runner.run();
    const service = new BackupService(
      db,
      { dbPath: join(dir, 'metrack.db'), imagesDir: join(dir, 'images') },
      join(dir, 'backups'),
    );
    const logger = { info: vi.fn(), error: vi.fn() };
    const job = new BackupJob(service, 5, { notify: vi.fn(async () => {}) }, logger);
    const app = await buildApp({
      appVersion: 'test',
      migrationRunner: runner,
      backup: { service, job },
    });

    const created = await app.inject({ method: 'POST', url: '/api/backups' });
    expect(created.statusCode).toBe(201);
    const listed = await app.inject({ method: 'GET', url: '/api/backups' });
    expect(listed.json()).toEqual([created.json()]);
    db.close();
  });

  it('returns a generic 500 when the backup fails and logs the details', async () => {
    const service = {
      create: () => {
        throw new Error("ENOSPC: no space left on device, open '/data/backups/x/metrack.db'");
      },
      list: () => [],
    } as unknown as BackupService;
    const logger = { info: vi.fn(), error: vi.fn() };
    const job = new BackupJob(service, 5, { notify: vi.fn(async () => {}) }, logger);
    const runner = new MigrationRunner(openDatabase(':memory:'), migrations);
    const app = await buildApp({
      appVersion: 'test',
      migrationRunner: runner,
      backup: { service, job },
    });
    const response = await app.inject({ method: 'POST', url: '/api/backups' });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'Backup failed', code: 'backup_failed' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('/data/backups/x/metrack.db'),
    );
  });
});
