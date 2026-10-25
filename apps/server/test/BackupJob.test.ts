import { describe, expect, it, vi } from 'vitest';
import { BackupJob } from '../src/backup/BackupJob.js';
import type { BackupService } from '../src/backup/BackupService.js';
import type { Notifier } from '../src/notify/Notifier.js';

const logger = { info: vi.fn(), error: vi.fn() };
const info = { name: 'n', createdAt: '2026-10-24T10:00:00.000Z', sizeBytes: 1, hasImages: false };

describe('BackupJob', () => {
  it('creates a backup, prunes and does not alert', async () => {
    const service = {
      create: vi.fn(() => info),
      prune: vi.fn(() => []),
    } as unknown as BackupService;
    const notifier: Notifier = { notify: vi.fn(async () => {}) };
    const result = await new BackupJob(service, 7, notifier, logger).run();
    expect(result).toBe(info);
    expect(service.prune).toHaveBeenCalledWith(7);
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('alerts and rethrows when the backup fails', async () => {
    const service = {
      create: vi.fn(() => {
        throw new Error('disk full');
      }),
      prune: vi.fn(),
    } as unknown as BackupService;
    const notifier: Notifier = { notify: vi.fn(async () => {}) };
    await expect(new BackupJob(service, 7, notifier, logger).run()).rejects.toThrow('disk full');
    expect(notifier.notify).toHaveBeenCalledWith('metrack backup failed', 'disk full');
    expect(service.prune).not.toHaveBeenCalled();
  });

  it('alerts once per failure streak and once on recovery', async () => {
    let fail = true;
    const service = {
      create: vi.fn(() => {
        if (fail) throw new Error('disk full');
        return info;
      }),
      prune: vi.fn(() => []),
    } as unknown as BackupService;
    const notifier: Notifier = { notify: vi.fn(async () => {}) };
    const job = new BackupJob(service, 7, notifier, logger);
    for (let i = 0; i < 3; i++) await expect(job.run()).rejects.toThrow('disk full');
    expect(notifier.notify).toHaveBeenCalledTimes(1);

    fail = false;
    await job.run();
    await job.run();
    expect(notifier.notify).toHaveBeenCalledTimes(2);
    expect(notifier.notify).toHaveBeenLastCalledWith(
      'metrack backup recovered',
      'backup n created',
      { priority: 'default', tags: ['white_check_mark'] },
    );

    fail = true;
    await expect(job.run()).rejects.toThrow('disk full');
    expect(notifier.notify).toHaveBeenCalledTimes(3);
  });
});
