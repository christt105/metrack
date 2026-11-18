import { describe, expect, it } from 'vitest';
import { toWireSyncState, type SyncState } from '../src/index.js';

describe('toWireSyncState', () => {
  it('keeps an empty overrides list for connectors up to v0.21.0', () => {
    const state: SyncState = { movies: [], series: [], seasons: [], unlinked: [] };
    expect(toWireSyncState(state).overrides).toEqual([]);
  });
});
