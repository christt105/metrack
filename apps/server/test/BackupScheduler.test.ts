import { describe, expect, it, vi } from 'vitest';
import type { BackupJob } from '../src/backup/BackupJob.js';
import { BackupScheduler } from '../src/backup/BackupScheduler.js';
import type { BackupService } from '../src/backup/BackupService.js';

const logger = { info: vi.fn(), error: vi.fn() };
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

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

  it('backs off after consecutive failures, doubling up to the interval', async () => {
    const run = vi.fn(async () => {
      throw new Error('boom');
    });
    let clock = Date.parse('2026-10-24T10:00:00Z');
    const service = { list: () => [] } as unknown as BackupService;
    const scheduler = new BackupScheduler(
      service,
      { run } as unknown as BackupJob,
      DAY,
      logger,
      () => new Date(clock),
      MINUTE * 10,
    );
    const attempts: number[] = [];
    for (let minute = 0; minute <= 3 * 24 * 60; minute += 10) {
      clock = Date.parse('2026-10-24T10:00:00Z') + minute * MINUTE;
      if (await scheduler.tick()) attempts.push(minute);
    }
    const gaps = attempts.slice(1).map((minute, i) => minute - attempts[i]!);
    expect(gaps.slice(0, 8)).toEqual([10, 20, 40, 80, 160, 320, 640, 1280]);
    expect(gaps.slice(8).every((gap) => gap === 24 * 60)).toBe(true);
  });

  it('resets the backoff after a successful run', async () => {
    let fail = true;
    const run = vi.fn(async () => {
      if (fail) throw new Error('boom');
      return {};
    });
    let clock = Date.parse('2026-10-24T10:00:00Z');
    const scheduler = new BackupScheduler(
      { list: () => [] } as unknown as BackupService,
      { run } as unknown as BackupJob,
      DAY,
      logger,
      () => new Date(clock),
      MINUTE * 10,
    );
    await scheduler.tick();
    clock += 10 * MINUTE;
    await scheduler.tick();
    fail = false;
    clock += 20 * MINUTE;
    expect(await scheduler.tick()).toBe(true);
    fail = true;
    expect(await scheduler.tick()).toBe(true);
    clock += 10 * MINUTE;
    expect(await scheduler.tick()).toBe(true);
    expect(run).toHaveBeenCalledTimes(5);
  });
});
