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
    const notifier: Notifier = { notify: vi.fn(async () => true) };
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
    const notifier: Notifier = { notify: vi.fn(async () => true) };
    await expect(new BackupJob(service, 7, notifier, logger).run()).rejects.toThrow('disk full');
    expect(notifier.notify).toHaveBeenCalledWith('metrack backup failed', 'disk full');
    expect(service.prune).not.toHaveBeenCalled();
  });
});
