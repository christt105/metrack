import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import SettingsView from '../src/views/SettingsView.vue';
import type { SyncPlan } from '@metrack/domain';
import type { BackupInfo } from '../src/api/BackupInfo';
import { mountWithApi } from './mountWithApi';

const health = { status: 'ok', appVersion: 'dev', schemaVersion: 3 };
const existing: BackupInfo = {
  name: 'metrack-20261001T000000000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  sizeBytes: 2_097_152,
  hasImages: true,
};
const created: BackupInfo = { ...existing, name: 'metrack-20261002T000000000Z' };

describe('SettingsView backups', () => {
  it('lists stored backups', async () => {
    const { wrapper } = await mountWithApi(SettingsView, {
      health: vi.fn().mockResolvedValue(health),
      listBackups: vi.fn().mockResolvedValue([existing]),
    });
    await flushPromises();
    expect(wrapper.text()).toContain(existing.name);
    expect(wrapper.text()).toContain('2.0 MB');
  });

  it('shows an empty state', async () => {
    const { wrapper } = await mountWithApi(SettingsView, {
      health: vi.fn().mockResolvedValue(health),
      listBackups: vi.fn().mockResolvedValue([]),
    });
    await flushPromises();
    expect(wrapper.text()).toContain('No backups yet.');
  });

  it('creates a backup and refreshes the list', async () => {
    const listBackups = vi
      .fn()
      .mockResolvedValueOnce([existing])
      .mockResolvedValueOnce([created, existing]);
    const createBackup = vi.fn().mockResolvedValue(created);
    const { wrapper } = await mountWithApi(SettingsView, {
      health: vi.fn().mockResolvedValue(health),
      listBackups,
      createBackup,
    });
    await flushPromises();
    const button = wrapper.findAll('button').find((b) => b.text() === 'Back up now');
    await button?.trigger('click');
    await flushPromises();
    expect(createBackup).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain(`Created ${created.name}.`);
    expect(wrapper.findAll('.backups li')).toHaveLength(2);
  });
});

describe('SettingsView Jellyfin sync', () => {
  const plan: SyncPlan = {
    movies: [],
    series: [
      {
        seriesId: 1,
        jellyfinId: 's',
        tmdbId: 1,
        tvdbId: 2,
        title: 'Lupin',
        year: 2021,
        seasons: [
          {
            seasonId: 5,
            matchedBy: 'air_date',
            jellyfinSeasonId: 'sn',
            number: 4,
            tmdbSeasonNumber: 3,
            title: null,
            firstAirDate: '2026-10-23',
            episodeCount: 3,
            status: 'in_progress',
            startedAt: '2026-10-24',
            finishedAt: null,
            watchedEpisodes: 1,
            missingRating: false,
          },
        ],
      },
    ],
    unlinked: [],
    warnings: [],
    ignoredPlays: 4,
    unmatchedTitles: [{ title: 'Gone', plays: 4 }],
  };
  const base = {
    health: vi.fn().mockResolvedValue(health),
    listBackups: vi.fn().mockResolvedValue([]),
  };

  it('checks without writing and shows the counts', async () => {
    const applySync = vi.fn();
    const { wrapper } = await mountWithApi(SettingsView, {
      ...base,
      syncReport: vi.fn().mockResolvedValue(plan),
      applySync,
    });
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Check viewings')
      ?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('1 season(s) to create or update');
    expect(wrapper.text()).toContain('4 play(s) of 1 title(s)');
    expect(applySync).not.toHaveBeenCalled();
  });

  it('applies only after the user confirms', async () => {
    const applySync = vi.fn().mockResolvedValue({ plan, result: {} });
    window.confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { wrapper } = await mountWithApi(SettingsView, {
      ...base,
      syncReport: vi.fn().mockResolvedValue(plan),
      applySync,
    });
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Check viewings')
      ?.trigger('click');
    await flushPromises();
    const apply = () => wrapper.findAll('button').find((b) => b.text() === 'Apply changes');
    await apply()?.trigger('click');
    expect(applySync).not.toHaveBeenCalled();
    await apply()?.trigger('click');
    await flushPromises();
    expect(applySync).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('Applied 2 change(s).');
  });

  it('says so when there is nothing to change', async () => {
    const empty: SyncPlan = { ...plan, series: [] };
    const { wrapper } = await mountWithApi(SettingsView, {
      ...base,
      syncReport: vi.fn().mockResolvedValue(empty),
    });
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Check viewings')
      ?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Nothing to change.');
    expect(wrapper.findAll('button').some((b) => b.text() === 'Apply changes')).toBe(false);
  });
});
