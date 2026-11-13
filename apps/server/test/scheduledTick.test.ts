import { describe, expect, it } from 'vitest';
import { AccountDeletionService } from '../src/account/AccountDeletionService.js';
import type { ImageStore } from '../src/images/ImageStore.js';
import type { AccountRepository } from '../src/storage/repositories/AccountRepository.js';
import type { UserRepository } from '../src/storage/repositories/UserRepository.js';
import { createWorkerHandler } from '../src/worker/createWorkerHandler.js';
import { ScheduledTick } from '../src/worker/ScheduledTick.js';
import type { WorkerEnv } from '../src/worker/WorkerEnv.js';

const HOUR_MS = 3_600_000;
const DAY = '2026-11-20T';

function setup(options: { dueUsers?: number[]; failing?: boolean } = {}) {
  const erased: number[] = [];
  const lines: string[] = [];
  const logger = { info: (m: string) => lines.push(m), error: (m: string) => lines.push(`E ${m}`) };
  const pending = [...(options.dueUsers ?? [])];
  const accounts = {
    dueForDeletion: async () => {
      if (options.failing) throw new Error('D1 down');
      return [...pending];
    },
    erase: async (id: number) => {
      erased.push(id);
      pending.splice(pending.indexOf(id), 1);
      return [];
    },
  } as unknown as AccountRepository;
  const images = { removeUnused: async () => [] } as unknown as ImageStore;
  const service = new AccountDeletionService(
    accounts,
    {} as UserRepository,
    images,
    null,
    logger,
    () => new Date(`${DAY}03:00:00Z`),
  );
  const tick = new ScheduledTick({ accounts: service, logger });
  return { tick, erased, lines };
}

const at = (hour: number): number => Date.parse(`${DAY}00:00:00Z`) + hour * HOUR_MS;

describe('ScheduledTick', () => {
  it('erases only one due account per tick and logs one line', async () => {
    const { tick, erased, lines } = setup({ dueUsers: [5, 6, 7] });
    await tick.run(at(3));
    expect(erased).toEqual([5]);
    await tick.run(at(4));
    expect(erased).toEqual([5, 6]);
    expect(lines.at(-1)).toBe('scheduled tick 2026-11-20T04:00:00.000Z: erased=1');
  });

  it('logs a failure of the erasing without rejecting', async () => {
    const { tick, lines } = setup({ dueUsers: [5], failing: true });
    await expect(tick.run(at(3))).resolves.toBeUndefined();
    expect(lines[0]).toBe('E account erasing failed: D1 down');
    expect(lines.at(-1)).toContain('erased=0');
  });
});

describe('Worker scheduled handler', () => {
  it('logs and resolves when the bindings are broken', async () => {
    const handler = createWorkerHandler();
    const error = console.error;
    const messages: string[] = [];
    console.error = (m: string) => messages.push(m);
    try {
      await expect(
        handler.scheduled(
          { scheduledTime: at(3), cron: '0 * * * *' },
          {} as WorkerEnv,
          {} as never,
        ),
      ).resolves.toBeUndefined();
    } finally {
      console.error = error;
    }
    expect(messages.join('\n')).toContain('account erasing failed');
  });
});
