import { describe, expect, it } from 'vitest';
import { addRewatch, canTransition, transitionStatus } from '../src/index.js';
import type { Tracking } from '../src/index.js';

const planned: Tracking = {
  status: 'planned',
  startedAt: null,
  finishedAt: null,
  rating: null,
  review: null,
  rewatches: [],
};

describe('transitionStatus', () => {
  it('sets startedAt when work begins', () => {
    const next = transitionStatus(planned, 'in_progress', '2026-01-02');
    expect(next).toMatchObject({
      status: 'in_progress',
      startedAt: '2026-01-02',
      finishedAt: null,
    });
  });

  it('sets finishedAt when completed and keeps an earlier startedAt', () => {
    const watching = transitionStatus(planned, 'in_progress', '2026-01-02');
    expect(transitionStatus(watching, 'completed', '2026-01-09')).toMatchObject({
      startedAt: '2026-01-02',
      finishedAt: '2026-01-09',
    });
  });

  it('allows completing straight from planned using one date for both', () => {
    expect(transitionStatus(planned, 'completed', '2026-03-15')).toMatchObject({
      startedAt: '2026-03-15',
      finishedAt: '2026-03-15',
    });
  });

  it('rejects disallowed transitions and does not mutate', () => {
    expect(canTransition('completed', 'paused')).toBe(false);
    expect(() => transitionStatus(planned, 'paused', '2026-01-02')).toThrow();
    expect(planned.status).toBe('planned');
  });
});

describe('addRewatch', () => {
  it('only works on completed items and keeps dates sorted and unique', () => {
    const done = transitionStatus(planned, 'completed', '2026-03-15');
    const again = addRewatch(addRewatch(done, '2026-05-01'), '2026-04-01');
    expect(again.rewatches).toEqual(['2026-04-01', '2026-05-01']);
    expect(addRewatch(again, '2026-04-01').rewatches).toHaveLength(2);
    expect(() => addRewatch(planned, '2026-04-01')).toThrow();
  });
});
