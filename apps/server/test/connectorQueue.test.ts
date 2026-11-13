import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConnectorQueue } from '../src/connector/ConnectorQueue.js';
import { ConnectorStateStore } from '../src/connector/ConnectorStateStore.js';
import { retryDelay } from '../src/connector/retryDelay.js';
import { FakeScheduler } from './support/FakeScheduler.js';
import { RecordingNotifier } from './support/RecordingNotifier.js';

const MINUTE = 60_000;
const logger = { info: () => {}, error: () => {} };

function setup(
  attempt: (userId: number) => Promise<string>,
  dir = mkdtempSync(join(tmpdir(), 'connector-')),
) {
  const scheduler = new FakeScheduler();
  const notifier = new RecordingNotifier();
  const store = new ConnectorStateStore(dir);
  let now = 1_000_000;
  const queue = new ConnectorQueue(
    attempt,
    store,
    notifier,
    logger,
    scheduler,
    { debounceMs: 120_000 },
    () => now,
  );
  return { queue, scheduler, notifier, store, dir, advance: (ms: number) => (now += ms) };
}

describe('retryDelay', () => {
  it('waits 1, 5, 15 and then 60 minutes', () => {
    expect([1, 2, 3, 4, 5, 20].map(retryDelay)).toEqual([
      MINUTE,
      5 * MINUTE,
      15 * MINUTE,
      60 * MINUTE,
      60 * MINUTE,
      60 * MINUTE,
    ]);
  });
});

describe('ConnectorQueue', () => {
  it('coalesces webhooks into one sync after the quiet time', async () => {
    const runs: number[] = [];
    const { queue, scheduler } = setup(async (id) => (runs.push(id), 'ok'));
    queue.markDirty(2);
    queue.markDirty(2);
    queue.markDirty(3);
    expect(scheduler.delays).toEqual([120_000, 120_000]);
    await scheduler.fire();
    await scheduler.fire();
    expect(runs).toEqual([2, 3]);
    expect(scheduler.pending()).toBe(0);
  });

  it('runs again after a change that arrives during a sync', async () => {
    let release: () => void = () => {};
    let runs = 0;
    const { queue, scheduler } = setup(async () => {
      runs += 1;
      if (runs === 1) await new Promise<void>((resolve) => (release = resolve));
      return 'ok';
    });
    queue.markDirty(2);
    const first = scheduler.fire();
    await new Promise((resolve) => setImmediate(resolve));
    queue.markDirty(2);
    release();
    await first;
    await new Promise((resolve) => setImmediate(resolve));
    expect(scheduler.pending()).toBe(1);
    await scheduler.fire();
    expect(runs).toBe(2);
  });

  it('keeps a failed user pending and retries after 1, 5, 15 and 60 minutes, recomputing each time', async () => {
    let attempts = 0;
    const { queue, scheduler } = setup(async () => {
      attempts += 1;
      throw new Error('cloud unreachable');
    });
    queue.markDirty(2);
    for (let i = 0; i < 5; i += 1) await scheduler.fire();
    expect(attempts).toBe(5);
    expect(scheduler.delays).toEqual([
      120_000,
      MINUTE,
      5 * MINUTE,
      15 * MINUTE,
      60 * MINUTE,
      60 * MINUTE,
    ]);
    expect(queue.failureCount(2)).toBe(5);
  });

  it('keeps the backoff when a webhook arrives while waiting', async () => {
    const { queue, scheduler } = setup(async () => {
      throw new Error('down');
    });
    queue.markDirty(2);
    await scheduler.fire();
    queue.markDirty(2);
    expect(scheduler.pending()).toBe(1);
    expect(scheduler.delays).toEqual([120_000, MINUTE]);
  });

  it('notifies once after three failures in a row and once when it recovers', async () => {
    let failing = true;
    const { queue, scheduler, notifier } = setup(async () => {
      if (failing) throw new Error('503 from the cloud');
      return 'ok';
    });
    queue.markDirty(2);
    await scheduler.fire();
    await scheduler.fire();
    expect(notifier.sent).toHaveLength(0);
    await scheduler.fire();
    await scheduler.fire();
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0]?.message).toContain('503 from the cloud');
    failing = false;
    await scheduler.fire();
    expect(notifier.sent).toHaveLength(2);
    expect(queue.failureCount(2)).toBe(0);
    expect(scheduler.pending()).toBe(0);
  });

  it('writes pending users to the state file and takes them up after a restart', async () => {
    const first = setup(async () => {
      throw new Error('down');
    });
    first.queue.markDirty(2);
    await first.scheduler.fire();
    expect(first.store.read().pending['2']).toMatchObject({ failures: 1 });

    const runs: number[] = [];
    const second = setup(async (id) => (runs.push(id), 'ok'), first.dir);
    second.queue.restore();
    expect(second.queue.failureCount(2)).toBe(1);
    await second.scheduler.fire();
    expect(runs).toEqual([2]);
    expect(second.store.read().pending).toEqual({});
  });
});
