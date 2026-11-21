import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import SteamAchievements from '../src/components/SteamAchievements.vue';
import { mountWithApi } from './mountWithApi';

const game = (over: object) => ({
  id: 9,
  steamAppId: '10',
  achievementsUnlocked: null,
  achievementsTotal: null,
  achievementsLastUnlockedAt: null,
  achievementsCheckedAt: null,
  ...over,
});

const text = async (over: object) => {
  const { wrapper } = await mountWithApi(SteamAchievements, {}, { game: game(over) });
  return wrapper.find('[data-test="achievements-text"]').text();
};

describe('SteamAchievements', () => {
  it('tells apart progress, no achievements and not checked', async () => {
    expect(
      await text({
        achievementsUnlocked: 23,
        achievementsTotal: 40,
        achievementsLastUnlockedAt: '2026-11-01',
      }),
    ).toBe('23 of 40 (last unlocked 2026-11-01)');
    expect(await text({ achievementsUnlocked: 40, achievementsTotal: 40 })).toBe('40 of 40');
    expect(await text({ achievementsUnlocked: 0, achievementsTotal: 0 })).toBe(
      'This game has no achievements',
    );
    expect(await text({})).toBe('Not checked yet');
  });

  it('refreshes that game and tells the page', async () => {
    const refreshSteamAchievements = vi
      .fn()
      .mockResolvedValue({ processed: 1, failed: 0, remaining: 0, asOf: 'T0' });
    const { wrapper } = await mountWithApi(
      SteamAchievements,
      { refreshSteamAchievements },
      { game: game({}) },
    );
    await wrapper.find('[data-test="achievements-button"]').trigger('click');
    await flushPromises();
    expect(refreshSteamAchievements).toHaveBeenCalledWith({ gameId: 9 });
    expect(wrapper.emitted('refreshed')).toHaveLength(1);
    expect(wrapper.find('[data-test="achievements-summary"]').text()).toBe('Checked 1 games.');
  });

  it('shows the server error', async () => {
    const refreshSteamAchievements = vi.fn().mockRejectedValue(new Error('Set your Steam account'));
    const { wrapper } = await mountWithApi(
      SteamAchievements,
      { refreshSteamAchievements },
      { game: game({}) },
    );
    await wrapper.find('[data-test="achievements-button"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Set your Steam account');
  });
});
