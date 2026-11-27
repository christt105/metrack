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
      { steam: { refreshSteamAchievements } },
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
      { steam: { refreshSteamAchievements } },
      { game: game({}) },
    );
    await wrapper.find('[data-test="achievements-button"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Set your Steam account');
  });

  const detail = {
    state: 'ok',
    unlocked: 1,
    total: 2,
    achievements: [
      {
        apiName: 'A',
        name: 'First',
        description: 'Do it',
        hidden: false,
        iconUrl: 'https://cdn.steamstatic.com/a.jpg',
        unlocked: true,
        unlockedAt: '2026-11-01T10:00:00.000Z',
      },
      {
        apiName: 'B',
        name: 'Secret',
        description: null,
        hidden: true,
        iconUrl: 'https://cdn.steamstatic.com/b.jpg',
        unlocked: false,
        unlockedAt: null,
      },
    ],
  };
  const counts = { achievementsUnlocked: 1, achievementsTotal: 2 };

  it('shows the list by default, loads it once and lets the user collapse it', async () => {
    const steamAchievements = vi.fn().mockResolvedValue(detail);
    const { wrapper } = await mountWithApi(
      SteamAchievements,
      { steam: { steamAchievements } },
      { game: game(counts) },
    );
    await flushPromises();
    expect(steamAchievements).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-test="achievements-bar"]').attributes('max')).toBe('2');
    expect(steamAchievements).toHaveBeenCalledWith(9, 'en');
    const items = wrapper.findAll('[data-test="achievement"]');
    expect(items).toHaveLength(2);
    expect(items[0]?.text()).toContain('First');
    expect(items[0]?.text()).toContain('Unlocked 2026-11-01');
    expect(items[1]?.classes()).toContain('locked');
    expect(items[1]?.text()).toContain('Hidden achievement');
    expect(items[1]?.find('img').attributes('src')).toBe('https://cdn.steamstatic.com/b.jpg');
    expect(wrapper.emitted('refreshed')).toBeUndefined();
    await wrapper.find('[data-test="achievements-toggle"]').trigger('click');
    expect(wrapper.find('[data-test="achievement-list"]').exists()).toBe(false);
    await wrapper.find('[data-test="achievements-toggle"]').trigger('click');
    expect(wrapper.find('[data-test="achievement-list"]').exists()).toBe(true);
    expect(steamAchievements).toHaveBeenCalledTimes(1);
  });

  it('asks the page to reload when the stored counts were stale', async () => {
    const steamAchievements = vi.fn().mockResolvedValue({ ...detail, unlocked: 2 });
    const { wrapper } = await mountWithApi(
      SteamAchievements,
      { steam: { steamAchievements } },
      { game: game(counts) },
    );
    await flushPromises();
    expect(wrapper.emitted('refreshed')).toHaveLength(1);
  });

  it('explains a private profile and a failed answer', async () => {
    const steamAchievements = vi
      .fn()
      .mockResolvedValueOnce({ state: 'private', unlocked: 0, total: 0, achievements: [] })
      .mockRejectedValueOnce(new Error('boom'));
    const { wrapper } = await mountWithApi(
      SteamAchievements,
      { steam: { steamAchievements } },
      { game: game({}) },
    );
    await flushPromises();
    expect(wrapper.find('[data-test="achievements-private"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="achievement-list"]').exists()).toBe(false);
  });

  it('offers no list for a game without achievements', async () => {
    const { wrapper } = await mountWithApi(
      SteamAchievements,
      {},
      { game: game({ achievementsUnlocked: 0, achievementsTotal: 0 }) },
    );
    expect(wrapper.find('[data-test="achievements-toggle"]').exists()).toBe(false);
  });
});
