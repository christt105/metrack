import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CloudBackup } from '../src/cloudbackup/CloudBackup.js';
import { CloudBackupJob } from '../src/cloudbackup/CloudBackupJob.js';
import { CloudBackupScheduler } from '../src/cloudbackup/CloudBackupScheduler.js';
import { nextDailyRun } from '../src/cloudbackup/nextDailyRun.js';
import { d1Dump } from './support/d1Dump.js';
import { FakeD1 } from './support/FakeD1.js';
import { FakeScheduler } from './support/FakeScheduler.js';
import { RecordingNotifier } from './support/RecordingNotifier.js';

const logger = { info: () => {}, error: () => {} };
const time = { hour: 4, minute: 30 };
const HOUR = 3_600_000;

let dir: string;
let failing: boolean;
let clock: Date;
let notifier: RecordingNotifier;
let scheduler: FakeScheduler;
let backup: CloudBackup;
let scheduled: CloudBackupScheduler;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cloud-schedule-'));
  failing = false;
  clock = new Date(2026, 10, 14, 10, 0, 0);
  notifier = new RecordingNotifier();
  scheduler = new FakeScheduler();
  backup = new CloudBackup(
    dir,
    14,
    new FakeD1(() => (failing ? new Error('D1 is down') : d1Dump())),
    undefined,
    () => clock,
  );
  scheduled = new CloudBackupScheduler(
    backup,
    new CloudBackupJob(backup, notifier, logger),
    time,
    scheduler,
    () => clock,
  );
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('nextDailyRun', () => {
  it('waits until the time today when it has not passed, otherwise until tomorrow', () => {
    expect(nextDailyRun(new Date(2026, 10, 14, 3, 30), time)).toBe(HOUR);
    expect(nextDailyRun(new Date(2026, 10, 14, 4, 30), time)).toBe(24 * HOUR);
    expect(nextDailyRun(new Date(2026, 10, 14, 10, 0), time)).toBe(18.5 * HOUR);
  });
});

describe('CloudBackupScheduler', () => {
  it('runs shortly after start when there is no copy, then every day', async () => {
    scheduled.start();
    expect(scheduler.delays).toEqual([60_000]);
    await scheduler.fire();
    expect(backup.list()).toHaveLength(1);
    expect(scheduler.delays[1]).toBe(18.5 * HOUR);
  });

  it('waits for the daily time at start when the newest copy is recent', async () => {
    await backup.run();
    clock = new Date(2026, 10, 14, 12, 0, 0);
    scheduled.start();
    expect(scheduler.delays).toEqual([16.5 * HOUR]);
  });

  it('retries a failed run after 1, 5 and 15 minutes, alerts once after three failures and says when it recovers', async () => {
    failing = true;
    scheduled.start();
    await scheduler.fire();
    await scheduler.fire();
    expect(notifier.sent).toEqual([]);
    await scheduler.fire();
    await scheduler.fire();
    expect(scheduler.delays.slice(1)).toEqual([60_000, 300_000, 900_000, 3_600_000]);
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0]!.title).toBe('metrack connector: the cloud backup failed');
    expect(notifier.sent[0]!.message).toContain('D1 is down');
    failing = false;
    await scheduler.fire();
    expect(notifier.sent[1]!.title).toBe('metrack connector: the cloud backup recovered');
    expect(scheduler.delays.at(-1)).toBe(18.5 * HOUR);
  });
});
