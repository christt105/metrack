import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import SettingsView from '../src/views/SettingsView.vue';
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
