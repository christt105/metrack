import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import SettingsView from '../src/views/SettingsView.vue';
import type { OwnSettings, SyncPlan, User, UserSettings } from '@metrack/domain';
import type { BackupInfo } from '../src/api/BackupInfo';
import { ApiRequestError } from '../src/api/ApiRequestError';
import { mountWithApi } from './mountWithApi';

const health = { status: 'ok', appVersion: 'dev', schemaVersion: 3 };
const existing: BackupInfo = {
  name: 'metrack-20261001T000000000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  sizeBytes: 2_097_152,
  hasImages: true,
};
const noSettings: UserSettings = {
  jellyfinUser: null,
  ntfyTopic: null,
  publishProject: null,
  publishBaseUrl: null,
  mirrorDir: null,
  mirrorLinkPrefix: null,
};
const ownerSettings: UserSettings = {
  ...noSettings,
  jellyfinUser: 'admin',
  publishProject: 'media-tracker',
  mirrorDir: '/vault/Media Tracker',
};
const owner: User = { id: 1, name: 'Owner', email: null, role: 'owner' };
const friend: User = { id: 2, name: 'Friend', email: null, role: 'normal' };

function ownerApi() {
  return {
    ownSettings: vi.fn().mockResolvedValue({
      settings: ownerSettings,
      publicPage: { handle: null, enabled: false },
      owner: true,
    } satisfies OwnSettings),
    listUsers: vi.fn().mockResolvedValue([
      { user: owner, settings: ownerSettings },
      { user: friend, settings: noSettings },
    ]),
  };
}

const created: BackupInfo = { ...existing, name: 'metrack-20261002T000000000Z' };

describe('SettingsView backups', () => {
  it('lists stored backups', async () => {
    const { wrapper } = await mountWithApi(SettingsView, {
      health: vi.fn().mockResolvedValue(health),
      ...ownerApi(),
      listBackups: vi.fn().mockResolvedValue([existing]),
    });
    await flushPromises();
    expect(wrapper.text()).toContain(existing.name);
    expect(wrapper.text()).toContain('2.0 MB');
  });

  it('shows an empty state', async () => {
    const { wrapper } = await mountWithApi(SettingsView, {
      health: vi.fn().mockResolvedValue(health),
      ...ownerApi(),
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
      ...ownerApi(),
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
            completes: false,
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
    ...ownerApi(),
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

describe('SettingsView user settings', () => {
  it('shows a user their settings and hides what only the owner can do', async () => {
    const listBackups = vi.fn();
    const listUsers = vi.fn();
    const { wrapper } = await mountWithApi(SettingsView, {
      health: vi.fn().mockResolvedValue(health),
      ownSettings: vi.fn().mockResolvedValue({
        settings: { ...noSettings, jellyfinUser: 'haku' },
        publicPage: { handle: null, enabled: false },
        owner: false,
      } satisfies OwnSettings),
      listBackups,
      listUsers,
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Your background jobs');
    expect(wrapper.text()).toContain('haku');
    expect(wrapper.text()).toContain('Jellyfin viewings');
    expect(wrapper.text()).not.toContain('Publish now');
    expect(wrapper.text()).not.toContain('Backups');
    expect(wrapper.find('form.user').exists()).toBe(false);
    expect(listBackups).not.toHaveBeenCalled();
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('lets the owner change what can be changed from the web', async () => {
    const updateUserSettings = vi
      .fn()
      .mockResolvedValue({ ...noSettings, jellyfinUser: 'haku', ntfyTopic: 'friend' });
    const { wrapper } = await mountWithApi(SettingsView, {
      health: vi.fn().mockResolvedValue(health),
      ...ownerApi(),
      listBackups: vi.fn().mockResolvedValue([]),
      updateUserSettings,
    });
    await flushPromises();
    const forms = wrapper.findAll('form.user');
    expect(forms).toHaveLength(2);
    expect(forms[0]!.find('input[name="mirrorDir"]').exists()).toBe(false);
    expect(forms[0]!.text()).toContain('/vault/Media Tracker');
    await forms[1]!.find('input[name="jellyfinUser"]').setValue('haku');
    await forms[1]!.find('input[name="ntfyTopic"]').setValue('friend');
    await forms[1]!.trigger('submit');
    await flushPromises();
    expect(updateUserSettings).toHaveBeenCalledWith(2, {
      jellyfinUser: 'haku',
      ntfyTopic: 'friend',
    });
    expect(wrapper.text()).toContain('Saved the settings of Friend.');
  });

  it('shows the problem next to each invalid setting', async () => {
    const updateUserSettings = vi.fn().mockRejectedValue(
      new ApiRequestError('Some settings are not valid', 400, 'invalid_settings', {
        ntfyTopic: 'letters, digits, "-" and "_", up to 64',
      }),
    );
    const { wrapper } = await mountWithApi(SettingsView, {
      health: vi.fn().mockResolvedValue(health),
      ...ownerApi(),
      listBackups: vi.fn().mockResolvedValue([]),
      updateUserSettings,
    });
    await flushPromises();
    const form = wrapper.findAll('form.user')[1]!;
    await form.find('input[name="ntfyTopic"]').setValue('two words');
    await form.trigger('submit');
    await flushPromises();
    expect(form.find('.problem').text()).toContain('up to 64');
    expect(form.find('input[name="ntfyTopic"]').attributes('aria-invalid')).toBe('true');
  });

  it('lets the owner make another user trusted, but never change the owner', async () => {
    const setUserRole = vi.fn().mockResolvedValue({ ...friend, role: 'trusted' });
    const { wrapper } = await mountWithApi(SettingsView, {
      health: vi.fn().mockResolvedValue(health),
      ...ownerApi(),
      listBackups: vi.fn().mockResolvedValue([]),
      setUserRole,
    });
    await flushPromises();
    const forms = wrapper.findAll('form.user');
    expect(forms[0]!.find('select[name="role"]').exists()).toBe(false);
    expect(forms[0]!.text()).toContain('Owner');
    await forms[1]!.find('select[name="role"]').setValue('trusted');
    await flushPromises();
    expect(setUserRole).toHaveBeenCalledWith(2, 'trusted');
    expect(wrapper.text()).toContain('Friend is now Trusted: may add items by hand.');
  });
});

describe('SettingsView images', () => {
  it('shows every user how much of their image quota they use', async () => {
    const { wrapper } = await mountWithApi(SettingsView, {
      health: vi.fn().mockResolvedValue(health),
      ownSettings: vi.fn().mockResolvedValue({
        settings: noSettings,
        publicPage: { handle: null, enabled: false },
        owner: false,
      } satisfies OwnSettings),
      imageUsage: vi.fn().mockResolvedValue({ usedBytes: 34_603_008, quotaBytes: 209_715_200 }),
    });
    await flushPromises();
    expect(wrapper.find('[data-test="image-usage"]').text()).toContain('33.0 MB of 200.0 MB');
  });

  it('says the owner has no limit', async () => {
    const { wrapper } = await mountWithApi(SettingsView, {
      health: vi.fn().mockResolvedValue(health),
      ownSettings: vi.fn().mockResolvedValue({
        settings: noSettings,
        publicPage: { handle: null, enabled: false },
        owner: false,
      } satisfies OwnSettings),
      imageUsage: vi.fn().mockResolvedValue({ usedBytes: 34_603_008, quotaBytes: null }),
    });
    await flushPromises();
    const text = wrapper.find('[data-test="image-usage"]').text();
    expect(text).toContain('33.0 MB');
    expect(text).toContain('no limit');
  });
});
