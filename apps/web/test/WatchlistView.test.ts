import { flushPromises, type VueWrapper } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { ReleaseAlert, WatchlistEntry } from '@metrack/domain';
import FollowToggle from '../src/components/FollowToggle.vue';
import WatchlistView from '../src/views/WatchlistView.vue';
import { mountWithApi } from './mountWithApi';

const lupin: WatchlistEntry = {
  type: 'series',
  id: 3,
  title: 'Lupin',
  cover: null,
  banner: null,
  nextEpisode: null,
  releaseDate: '2026-10-23',
};
const heat: WatchlistEntry = {
  type: 'movie',
  id: 8,
  title: 'Heat 2',
  cover: null,
  banner: null,
  nextEpisode: null,
  releaseDate: null,
};
const alert: ReleaseAlert = {
  id: 1,
  subjectType: 'season',
  subjectId: 5,
  kind: 'releases_tomorrow',
  title: 'Lupin, season 3',
  message: 'Releases tomorrow (2026-10-23)',
  sentAt: '2026-10-22T09:00:00.000Z',
};

async function showAll(wrapper: VueWrapper): Promise<void> {
  const chip = wrapper.findAll('.views button').find((b) => b.text() === 'All followed');
  await chip?.trigger('click');
}

describe('WatchlistView', () => {
  it('shows the next episode in the agenda and on the calendar', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 12));
    const show: WatchlistEntry = {
      ...lupin,
      nextEpisode: { seasonNumber: 4, episodeNumber: 2, airDate: '2026-11-17', name: 'The Heist' },
    };
    const premiere: WatchlistEntry = { ...heat, releaseDate: '2026-12-25' };
    const { wrapper } = await mountWithApi(WatchlistView, {
      listWatchlist: vi.fn().mockResolvedValue([show, premiere]),
      listAlerts: vi.fn().mockResolvedValue([]),
    });
    await flushPromises();
    const agenda = wrapper.find('.agenda').text();
    expect(agenda).toContain('Tomorrow');
    expect(agenda).toContain('S4 · E2 · The Heist');
    expect(agenda).toContain('December 2026');
    expect(agenda).toContain('Premiere');

    const calendarChip = wrapper.findAll('.views button').find((b) => b.text() === 'Calendar');
    await calendarChip?.trigger('click');
    const day = wrapper.find('button[aria-label^="Tuesday 17 November"]');
    expect(day.attributes('aria-label')).toContain('Lupin');
    await day.trigger('click');
    expect(wrapper.find('.selected').text()).toContain('S4 · E2 · The Heist');
    vi.useRealTimers();
  });

  it('lists followed titles and sent alerts', async () => {
    const { wrapper } = await mountWithApi(WatchlistView, {
      listWatchlist: vi.fn().mockResolvedValue([lupin, heat]),
      listAlerts: vi.fn().mockResolvedValue([alert]),
    });
    await flushPromises();
    expect(wrapper.find('.waiting').text()).toContain('Lupin');
    await showAll(wrapper);
    const text = wrapper.text();
    expect(text).toContain('Lupin');
    expect(text).toContain('Latest release 2026-10-23');
    expect(text).toContain('Heat 2');
    expect(text).toContain('No release date');
    expect(text).toContain('Lupin, season 3');
    expect(text).toContain('Releases tomorrow');
    expect(text).toContain('2026-10-22 09:00');
    expect(wrapper.find('a[href="/series/3"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/movies/8"]').exists()).toBe(true);
  });

  it('shows empty states', async () => {
    const { wrapper } = await mountWithApi(WatchlistView, {
      listWatchlist: vi.fn().mockResolvedValue([]),
      listAlerts: vi.fn().mockResolvedValue([]),
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Nothing is followed yet.');
    expect(wrapper.text()).toContain('No alert has been sent yet.');
  });

  it('unfollows a title and reloads the list', async () => {
    const listWatchlist = vi.fn().mockResolvedValueOnce([lupin]).mockResolvedValueOnce([]);
    const unfollow = vi.fn().mockResolvedValue(undefined);
    const { wrapper } = await mountWithApi(WatchlistView, {
      listWatchlist,
      listAlerts: vi.fn().mockResolvedValue([]),
      unfollow,
    });
    await flushPromises();
    await showAll(wrapper);
    await wrapper.find('.entry button').trigger('click');
    await flushPromises();
    expect(unfollow).toHaveBeenCalledWith('series', 3);
    expect(wrapper.text()).toContain('Nothing is followed yet.');
  });
});

describe('FollowToggle', () => {
  it('follows and reports the new state', async () => {
    const follow = vi.fn().mockResolvedValue(undefined);
    const { wrapper } = await mountWithApi(
      FollowToggle,
      { follow },
      { collection: 'movies', id: 8, following: false },
    );
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(follow).toHaveBeenCalledWith('movies', 8);
    expect(wrapper.emitted('changed')).toEqual([[true]]);
  });

  it('unfollows when already following', async () => {
    const unfollow = vi.fn().mockResolvedValue(undefined);
    const { wrapper } = await mountWithApi(
      FollowToggle,
      { unfollow },
      { collection: 'series', id: 3, following: true },
    );
    expect(wrapper.text()).toContain('Stop following');
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(unfollow).toHaveBeenCalledWith('series', 3);
    expect(wrapper.emitted('changed')).toEqual([[false]]);
  });

  it('shows the error and keeps the state when the request fails', async () => {
    const follow = vi.fn().mockRejectedValue(new Error('down'));
    const { wrapper } = await mountWithApi(
      FollowToggle,
      { follow },
      { collection: 'movies', id: 8, following: false },
    );
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(wrapper.emitted('changed')).toBeUndefined();
    expect(wrapper.text()).toContain('down');
  });
});
