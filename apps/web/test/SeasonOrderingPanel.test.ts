import { fakeApi } from './fakeApi';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeGroupOptions, User } from '@metrack/domain';
import { ApiRequestError } from '../src/api/ApiRequestError';
import { Session } from '../src/auth/Session';
import { sessionKey } from '../src/auth/sessionKey';
import SeasonOrderingPanel from '../src/components/SeasonOrderingPanel.vue';
import { mountWithApi } from './mountWithApi';

const OPTIONS: EpisodeGroupOptions = {
  current: null,
  suggested: 'seasons',
  groups: [
    { id: 'cours', name: 'Cours', type: 7, groupCount: 3, episodeCount: 38 },
    { id: 'seasons', name: 'Seasons', type: 6, groupCount: 3, episodeCount: 64 },
  ],
};

function sessionOf(role: User['role']): Record<symbol, unknown> {
  const session = new Session(fakeApi({}));
  session.signedIn({ id: 1, name: 'U', email: null, role });
  return { [sessionKey as symbol]: session };
}

afterEach(() => vi.unstubAllGlobals());

describe('SeasonOrderingPanel', () => {
  it('preselects the suggested group and says why', async () => {
    const { wrapper } = await mountWithApi(
      SeasonOrderingPanel,
      { episodeGroups: vi.fn().mockResolvedValue(OPTIONS) },
      { seriesId: 7, hasUnlinkedSeasons: true },
      sessionOf('normal'),
    );
    await flushPromises();
    expect(wrapper.text()).toContain('"Seasons" ordering has them');
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('seasons');
    expect(wrapper.findAll('option').map((o) => o.text())).toEqual([
      'TMDB seasons',
      'Cours (TV, 3 seasons, 38 episodes)',
      'Seasons (Production, 3 seasons, 64 episodes)',
    ]);
  });

  it('loads nothing until opened when no season needs an ordering', async () => {
    const episodeGroups = vi.fn().mockResolvedValue({ ...OPTIONS, suggested: null });
    const { wrapper } = await mountWithApi(
      SeasonOrderingPanel,
      { episodeGroups },
      { seriesId: 7, hasUnlinkedSeasons: false },
      sessionOf('normal'),
    );
    await flushPromises();
    expect(episodeGroups).not.toHaveBeenCalled();
    const details = wrapper.find('details');
    (details.element as HTMLDetailsElement).open = true;
    await details.trigger('toggle');
    await flushPromises();
    expect(episodeGroups).toHaveBeenCalledWith(7);
    expect(wrapper.find('.suggestion').exists()).toBe(false);
  });

  it('applies the chosen group and tells the parent', async () => {
    const setSeasonOrdering = vi.fn().mockResolvedValue({});
    const { wrapper } = await mountWithApi(
      SeasonOrderingPanel,
      { episodeGroups: vi.fn().mockResolvedValue(OPTIONS), setSeasonOrdering },
      { seriesId: 7, hasUnlinkedSeasons: true },
      sessionOf('normal'),
    );
    await flushPromises();
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(setSeasonOrdering).toHaveBeenCalledWith(7, 'seasons', {});
    expect(wrapper.emitted('changed')).toHaveLength(1);
  });

  it('asks the owner before changing a series other users have, then applies it for everyone', async () => {
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirm);
    const setSeasonOrdering = vi
      .fn()
      .mockRejectedValueOnce(new ApiRequestError('shared', 409, 'catalog_shared'))
      .mockResolvedValueOnce({});
    const { wrapper } = await mountWithApi(
      SeasonOrderingPanel,
      { episodeGroups: vi.fn().mockResolvedValue(OPTIONS), setSeasonOrdering },
      { seriesId: 7, hasUnlinkedSeasons: true },
      sessionOf('owner'),
    );
    await flushPromises();
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('every user who has this series'));
    expect(setSeasonOrdering).toHaveBeenLastCalledWith(7, 'seasons', { forAll: true });
  });

  it('tells a normal user that only the owner can change a shared series', async () => {
    const confirm = vi.fn();
    vi.stubGlobal('confirm', confirm);
    const setSeasonOrdering = vi
      .fn()
      .mockRejectedValue(new ApiRequestError('shared', 409, 'catalog_shared'));
    const { wrapper } = await mountWithApi(
      SeasonOrderingPanel,
      { episodeGroups: vi.fn().mockResolvedValue(OPTIONS), setSeasonOrdering },
      { seriesId: 7, hasUnlinkedSeasons: true },
      sessionOf('normal'),
    );
    await flushPromises();
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(confirm).not.toHaveBeenCalled();
    expect(wrapper.find('[role="alert"]').text()).toContain(
      'only the owner can change its ordering',
    );
  });
});
