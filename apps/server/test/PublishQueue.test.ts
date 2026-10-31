import { describe, expect, it } from 'vitest';
import type { Logger } from '../src/notify/Logger.js';
import type { Notifier } from '../src/notify/Notifier.js';
import { PublishQueue } from '../src/publish/PublishQueue.js';
import type { PublishOutcome } from '../src/publish/PublishOutcome.js';
import { FakeScheduler } from './support/FakeScheduler.js';

const options = { debounceMs: 10, baseDelayMs: 100, maxDelayMs: 350 };

function setup(results: (PublishOutcome | Error)[], delivered: boolean[] = [], label?: string) {
  const scheduler = new FakeScheduler();
  const alerts: string[] = [];
  const logs: string[] = [];
  const notifier: Notifier = {
    notify: async (title, message) => {
      alerts.push(`${title}|${message}`);
      return delivered[alerts.length - 1] ?? true;
    },
  };
  const logger: Logger = { info: (m) => void logs.push(m), error: (m) => void logs.push(m) };
  let calls = 0;
  const attempt = async (): Promise<PublishOutcome> => {
    const result = results[calls++] ?? 'published';
    if (result instanceof Error) throw result;
    return result;
  };
  const queue = new PublishQueue(attempt, notifier, logger, scheduler, { ...options, label });
  return { queue, scheduler, alerts, logs, calls: () => calls };
}

describe('PublishQueue', () => {
  it('does nothing until something changes', () => {
    const { scheduler, calls } = setup([]);
    expect(scheduler.pending()).toBe(0);
    expect(calls()).toBe(0);
  });

  it('coalesces a burst of changes into one publish after the debounce', async () => {
    const { queue, scheduler, calls } = setup(['published']);
    queue.markDirty();
    queue.markDirty();
    queue.markDirty();
    expect(scheduler.delays).toEqual([10]);
    await scheduler.fire();
    expect(calls()).toBe(1);
    expect(scheduler.pending()).toBe(0);
  });

  it('retries with exponential backoff capped at the maximum and alerts once per run of failures', async () => {
    const { queue, scheduler, alerts, calls } = setup([
      new Error('one'),
      new Error('two'),
      new Error('three'),
      new Error('four'),
      'published',
    ]);
    queue.markDirty();
    for (let i = 0; i < 5; i += 1) await scheduler.fire();
    expect(calls()).toBe(5);
    expect(scheduler.delays).toEqual([10, 100, 200, 350, 350]);
    expect(alerts).toEqual([
      'metrack publish failed|Attempt 1 failed: one. Retrying in 0s.',
      'metrack publish recovered|Publish published',
    ]);
    expect(queue.failureCount()).toBe(0);
  });

  it('keeps trying to deliver the failure alert until the notifier accepts it', async () => {
    const { queue, scheduler, alerts } = setup(
      [new Error('one'), new Error('two'), new Error('three'), 'published'],
      [false, true],
    );
    queue.markDirty();
    for (let i = 0; i < 4; i += 1) await scheduler.fire();
    expect(alerts).toEqual([
      'metrack publish failed|Attempt 1 failed: one. Retrying in 0s.',
      'metrack publish failed|Attempt 2 failed: two. Retrying in 0s.',
      'metrack publish recovered|Publish published',
    ]);
  });

  it('sends no recovery message when no failure was reported', async () => {
    const { queue, scheduler, alerts } = setup(['published']);
    queue.markDirty();
    await scheduler.fire();
    expect(alerts).toEqual([]);
  });

  it('publishes again after a change that arrives while publishing', async () => {
    const scheduler = new FakeScheduler();
    let release: () => void = () => {};
    let calls = 0;
    const queue = new PublishQueue(
      async () => {
        calls += 1;
        if (calls === 1) await new Promise<void>((resolve) => (release = resolve));
        return 'published';
      },
      { notify: async () => true },
      { info: () => {}, error: () => {} },
      scheduler,
      options,
    );
    queue.markDirty();
    await scheduler.fire();
    queue.markDirty();
    expect(scheduler.pending()).toBe(0);
    release();
    await new Promise((resolve) => setImmediate(resolve));
    expect(scheduler.pending()).toBe(1);
    await scheduler.fire();
    expect(calls).toBe(2);
  });

  it('keeps a change made during backoff for the scheduled retry', async () => {
    const { queue, scheduler, calls } = setup([new Error('x'), 'published']);
    queue.markDirty();
    await scheduler.fire();
    queue.markDirty();
    expect(scheduler.pending()).toBe(1);
    await scheduler.fire();
    expect(calls()).toBe(2);
  });

  it('names what it runs in logs and alerts', async () => {
    const { queue, scheduler, alerts, logs } = setup(
      [new Error('disk full'), 'published'],
      [],
      'vault mirror',
    );
    queue.markDirty();
    await scheduler.fire();
    await scheduler.fire();
    expect(alerts).toEqual([
      'metrack vault mirror failed|Attempt 1 failed: disk full. Retrying in 0s.',
      'metrack vault mirror recovered|Vault mirror published',
    ]);
    expect(logs).toEqual(['Vault mirror failed (attempt 1): disk full', 'Vault mirror published']);
  });
});
