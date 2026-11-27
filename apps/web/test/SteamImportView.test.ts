import type { ApiOverrides } from './ApiOverrides';
import type { SteamImportReport } from '@metrack/domain';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import SteamImportView from '../src/views/SteamImportView.vue';
import { ApiRequestError } from '../src/api/ApiRequestError';
import { mountWithApi } from './mountWithApi';

const row = (appId: string, extra: object = {}) => ({
  appId,
  name: `Game ${appId}`,
  playtimeMinutes: 120,
  recentMinutes: 0,
  lastPlayedAt: '2026-05-01T10:00:00.000Z',
  action: 'import' as const,
  source: 'igdb' as const,
  storedMinutes: null,
  status: 'paused' as const,
  selected: true,
  ...extra,
});

const report: SteamImportReport = {
  steamId: '76561198012345678',
  owned: 6,
  upToDate: 1,
  rows: [
    row('1'),
    row('2', { playtimeMinutes: 60, recentMinutes: 5, status: 'in_progress' }),
    row('3', { action: 'update', source: 'library', storedMinutes: 30, status: null }),
    row('4', { playtimeMinutes: 0, status: 'planned', selected: false, lastPlayedAt: null }),
    row('5', { playtimeMinutes: 0, status: 'planned', selected: false, lastPlayedAt: null }),
  ],
  unmatched: [{ appId: '9', name: 'Mystery', playtimeMinutes: 10 }],
};

async function loaded(steam: NonNullable<ApiOverrides['steam']> = {}) {
  const result = await mountWithApi(SteamImportView, {
    steam: { steamReport: async () => report, ...steam },
  });
  await result.wrapper.find('[data-test="steam-check"]').trigger('click');
  await flushPromises();
  return result;
}

const checked = (wrapper: Awaited<ReturnType<typeof loaded>>['wrapper']) =>
  wrapper
    .findAll('tbody input[type="checkbox"]')
    .map((box) => (box.element as HTMLInputElement).checked);

describe('SteamImportView', () => {
  it('shows the report with the played games selected and the never played ones not', async () => {
    const { wrapper } = await loaded();
    expect(wrapper.find('[data-test="steam-summary"]').text()).toContain('6 games owned');
    expect(checked(wrapper)).toEqual([true, true, true, false, false]);
    expect(wrapper.find('[data-test="steam-row-3"]').text()).toContain('30 min');
    expect(wrapper.find('[data-test="steam-row-3"]').text()).toContain('2 h');
    expect(wrapper.find('[data-test="steam-row-2"]').text()).toContain('Add as In progress');
    expect(wrapper.find('[data-test="steam-row-1"]').text()).toContain('2026-05-01');
    expect(wrapper.find('[data-test="steam-unmatched"]').text()).toContain('Mystery');
    expect(wrapper.find('[data-test="steam-import"]').text()).toContain('Import 3 selected');
  });

  it('selects all, none, and the never played games with their checkbox', async () => {
    const { wrapper } = await loaded();
    await wrapper.find('[data-test="steam-none"]').trigger('click');
    expect(checked(wrapper)).toEqual([false, false, false, false, false]);
    expect(wrapper.find('[data-test="steam-import"]').attributes('disabled')).toBeDefined();
    await wrapper.find('[data-test="steam-all"]').trigger('click');
    expect(checked(wrapper)).toEqual([true, true, true, true, true]);
    await wrapper.find('[data-test="steam-never-played"]').setValue(false);
    expect(checked(wrapper)).toEqual([true, true, true, false, false]);
    await wrapper.find('[data-test="steam-never-played"]').setValue(true);
    expect(checked(wrapper)).toEqual([true, true, true, true, true]);
    await wrapper.findAll('tbody input[type="checkbox"]')[0]?.setValue(false);
    expect(wrapper.find('[data-test="steam-import"]').text()).toContain('Import 4 selected');
  });

  it('applies only the selected rows, in batches, with a progress bar that fills', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const applySteam = vi.fn(async (appIds: string[]) => {
      if (applySteam.mock.calls.length === 1) await gate;
      return {
        outcomes: appIds.map((appId, index) => ({
          appId,
          result:
            index === 0 && applySteam.mock.calls.length === 1
              ? ('deferred' as const)
              : ('imported' as const),
        })),
      };
    });
    const { wrapper } = await loaded({
      applySteam,
      prepareSteamArtwork: async () => ({ processed: 1, remaining: 0 }),
    });
    await wrapper.findAll('tbody input[type="checkbox"]')[1]?.setValue(false);
    await wrapper.find('[data-test="steam-import"]').trigger('click');
    await flushPromises();
    const bar = wrapper.find('progress');
    expect(bar.attributes('max')).toBe('2');
    expect(bar.attributes('value')).toBe('0');
    expect(wrapper.find('[data-test="steam-import"]').attributes('disabled')).toBeDefined();
    release();
    await flushPromises();
    expect(applySteam.mock.calls.map(([ids]) => ids)).toEqual([['1', '3'], ['1']]);
    expect(wrapper.find('progress').exists()).toBe(false);
    expect(wrapper.find('[data-test="steam-result"]').text()).toContain('2 added');
  });

  it('prepares the artwork after importing, showing how many are left, and not when nothing was added', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const answers = [
      { processed: 1, remaining: 1 },
      { processed: 1, remaining: 0 },
    ];
    const prepareSteamArtwork = vi.fn(async () => {
      if (prepareSteamArtwork.mock.calls.length === 1) await gate;
      return answers.shift() ?? { processed: 0, remaining: 0 };
    });
    const applySteam = async (appIds: string[]) => ({
      outcomes: appIds.map((appId) => ({ appId, result: 'imported' as const })),
    });
    const { wrapper } = await loaded({ applySteam, prepareSteamArtwork });
    await wrapper.find('[data-test="steam-import"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="steam-artwork"]').text()).toBe('Preparing artwork, 3 left');
    expect(wrapper.find('[data-test="steam-import"]').attributes('disabled')).toBeDefined();
    release();
    await flushPromises();
    expect(prepareSteamArtwork).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[data-test="steam-artwork"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="steam-result"]').text()).toContain('3 added');

    const skipped = vi.fn();
    const none = await loaded({
      applySteam: async (appIds: string[]) => ({
        outcomes: appIds.map((appId) => ({ appId, result: 'skipped' as const })),
      }),
      prepareSteamArtwork: skipped,
    });
    await none.wrapper.find('[data-test="steam-import"]').trigger('click');
    await flushPromises();
    expect(skipped).not.toHaveBeenCalled();
  });

  it('keeps the import result and shows the error when preparing the artwork fails', async () => {
    const applySteam = async (appIds: string[]) => ({
      outcomes: appIds.map((appId) => ({ appId, result: 'imported' as const })),
    });
    const prepareSteamArtwork = async () => {
      throw new ApiRequestError('Steam could not be reached', 502, 'steam_unavailable');
    };
    const { wrapper } = await loaded({ applySteam, prepareSteamArtwork });
    await wrapper.find('[data-test="steam-import"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="steam-result"]').text()).toContain('3 added');
    expect(wrapper.text()).toContain('Steam could not be reached');
    expect(wrapper.find('[data-test="steam-artwork"]').exists()).toBe(false);
  });

  it('lists the games that failed', async () => {
    const applySteam = async (appIds: string[]) => ({
      outcomes: appIds.map((appId) => ({
        appId,
        result: 'failed' as const,
        error: 'IGDB is down',
      })),
    });
    const { wrapper } = await loaded({ applySteam });
    await wrapper.find('[data-test="steam-import"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="steam-result"]').text()).toContain('Game 1: IGDB is down');
  });

  it('shows the private profile message from the server', async () => {
    const steamReport = async () => {
      throw new ApiRequestError(
        'Steam returned no games: the profile or its Game details are private, or the account owns none',
        422,
        'steam_profile_private',
      );
    };
    const { wrapper } = await mountWithApi(SteamImportView, { steam: { steamReport } });
    await wrapper.find('[data-test="steam-check"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Game details are private');
    expect(wrapper.find('[data-test="steam-rows"]').exists()).toBe(false);
  });
});
