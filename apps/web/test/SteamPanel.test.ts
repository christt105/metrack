import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import SteamPanel from '../src/components/SteamPanel.vue';
import { mountWithApi } from './mountWithApi';

describe('SteamPanel', () => {
  it('saves what the user typed and tells the page', async () => {
    const updateSteamId = vi.fn().mockResolvedValue({ steamId: '76561198012345678' });
    const { wrapper } = await mountWithApi(
      SteamPanel,
      { settings: { updateSteamId } },
      { steamId: null, canImport: true },
    );
    await wrapper.find('[data-test="steam-input"]').setValue('steamcommunity.com/id/gaben');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(updateSteamId).toHaveBeenCalledWith('steamcommunity.com/id/gaben');
    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect((wrapper.find('[data-test="steam-input"]').element as HTMLInputElement).value).toBe(
      '76561198012345678',
    );
  });

  it('unlinks with null when emptied and shows the server error', async () => {
    const updateSteamId = vi
      .fn()
      .mockRejectedValue(new Error('Steam has no profile with that name'));
    const { wrapper } = await mountWithApi(
      SteamPanel,
      { settings: { updateSteamId } },
      { steamId: '76561198012345678', canImport: true },
    );
    await wrapper.find('[data-test="steam-input"]').setValue('');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(updateSteamId).toHaveBeenCalledWith(null);
    expect(wrapper.text()).toContain('Steam has no profile with that name');
  });

  it('links to the import only when an account is linked and the server can import', async () => {
    const link = '[data-test="steam-import-link"]';
    const on = await mountWithApi(SteamPanel, {}, { steamId: '1', canImport: true });
    expect(on.wrapper.find(link).exists()).toBe(true);
    const off = await mountWithApi(SteamPanel, {}, { steamId: '1', canImport: false });
    expect(off.wrapper.find(link).exists()).toBe(false);
    expect(off.wrapper.text()).toContain('no Steam API key');
    const unlinked = await mountWithApi(SteamPanel, {}, { steamId: null, canImport: true });
    expect(unlinked.wrapper.find(link).exists()).toBe(false);
  });

  it('checks the achievements of every game in passes with progress', async () => {
    const answers = [
      { processed: 11, failed: 0, remaining: 4, asOf: 'T0' },
      { processed: 4, failed: 1, remaining: 0, asOf: 'T0' },
    ];
    const refreshSteamAchievements = vi.fn(async () => answers.shift()!);
    const { wrapper } = await mountWithApi(
      SteamPanel,
      { steam: { refreshSteamAchievements } },
      { steamId: '1', canImport: true },
    );
    await wrapper.find('[data-test="achievements-button"]').trigger('click');
    await flushPromises();
    expect(refreshSteamAchievements).toHaveBeenNthCalledWith(1, {});
    expect(refreshSteamAchievements).toHaveBeenNthCalledWith(2, { asOf: 'T0' });
    expect(wrapper.find('[data-test="achievements-summary"]').text()).toContain(
      'Checked 15 games, 1 could not',
    );
    const off = await mountWithApi(SteamPanel, {}, { steamId: '1', canImport: false });
    expect(off.wrapper.find('[data-test="achievements-button"]').exists()).toBe(false);
  });
});
