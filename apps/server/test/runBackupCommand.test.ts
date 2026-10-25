import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runBackupCommand } from '../src/backup/runBackupCommand.js';
import { loadConfig } from '../src/config/loadConfig.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { openDatabase } from '../src/storage/openDatabase.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'metrack-cli-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('runBackupCommand', () => {
  it('refuses to back up a data directory without a database', async () => {
    const config = loadConfig({ DATA_DIR: dir });
    await expect(runBackupCommand(config, 'backup', undefined)).rejects.toThrow('No database');
    expect(existsSync(join(dir, 'metrack.db'))).toBe(false);
  });

  it('creates, lists and restores a backup', async () => {
    const db = openDatabase(join(dir, 'metrack.db'));
    new MigrationRunner(db, migrations).run();
    db.close();
    const config = loadConfig({ DATA_DIR: dir });

    const name = await runBackupCommand(config, 'backup', undefined);
    expect(await runBackupCommand(config, 'backups', undefined)).toContain(name);
    const message = await runBackupCommand(config, 'restore', name);

    expect(message).toMatch(
      /^restored metrack-\S+; the replaced data was moved to \S+pre-restore-/,
    );
    const restored = openDatabase(join(dir, 'metrack.db'));
    expect(new MigrationRunner(restored, migrations).currentVersion()).toBe(migrations.length);
    restored.close();
  });
});
