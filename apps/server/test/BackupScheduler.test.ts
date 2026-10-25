import { describe, expect, it, vi } from 'vitest';
import type { BackupJob } from '../src/backup/BackupJob.js';
import { BackupScheduler } from '../src/backup/BackupScheduler.js';
import type { BackupService } from '../src/backup/BackupService.js';

const logger = { info: vi.fn(), error: vi.fn() };
const DAY = 24 * 3_600_000;

function build(newest: string | undefined, now: string, run = vi.fn(async () => ({}))) {
  const service = {
    list: () => (newest ? [{ createdAt: newest }] : []),
  } as unknown as BackupService;
  const job = { run } as unknown as BackupJob;
  return { scheduler: new BackupScheduler(service, job, DAY, logger, () => new Date(now)), run };
}

describe('BackupScheduler', () => {
  it('runs when no backup exists', async () => {
    const { scheduler, run } = build(undefined, '2026-10-24T10:00:00Z');
    expect(await scheduler.tick()).toBe(true);
    expect(run).toHaveBeenCalledOnce();
  });

  it('skips when the newest backup is younger than the interval', async () => {
    const { scheduler, run } = build('2026-10-24T00:00:00Z', '2026-10-24T10:00:00Z');
    expect(await scheduler.tick()).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('runs when the newest backup is older than the interval', async () => {
    const { scheduler, run } = build('2026-10-23T09:00:00Z', '2026-10-24T10:00:00Z');
    expect(await scheduler.tick()).toBe(true);
    expect(run).toHaveBeenCalledOnce();
  });

  it('survives a failing job', async () => {
    const run = vi.fn(async () => {
      throw new Error('boom');
    });
    const { scheduler } = build(undefined, '2026-10-24T10:00:00Z', run);
    await expect(scheduler.tick()).resolves.toBe(true);
  });
});
