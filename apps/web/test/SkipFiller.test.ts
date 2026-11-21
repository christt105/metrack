import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { FillerPreviewEpisode, FillerPreviewResponse } from '@metrack/domain';
import { ApiRequestError } from '../src/api/ApiRequestError';
import SkipFiller from '../src/components/SkipFiller.vue';
import { mountWithApi } from './mountWithApi';

const ep = (
  seasonId: number,
  number: number,
  category: FillerPreviewEpisode['category'],
  watched = false,
): FillerPreviewEpisode => ({
  seasonId,
  seasonNumber: seasonId,
  key: `${seasonId}${number}`,
  number,
  title: `T${number}`,
  absoluteNumber: (seasonId - 1) * 3 + number,
  category,
  watched,
  skipped: false,
});

const response: FillerPreviewResponse = {
  slug: 'show',
  sourceUrl: 'https://www.animefillerlist.com/shows/show',
  counts: { filler: 3, mixed: 1, mangaCanon: 2, animeCanon: 0 },
  episodes: [
    ep(1, 1, 'mangaCanon'),
    ep(1, 2, 'filler'),
    ep(1, 3, 'mixed'),
    ep(2, 1, 'filler', true),
    ep(2, 2, 'filler'),
    ep(2, 3, 'mangaCanon'),
  ],
};

async function open(api: Record<string, unknown>) {
  const { wrapper } = await mountWithApi(SkipFiller, api, { seriesId: 7 });
  await wrapper.get('[data-test="filler-open"]').trigger('click');
  await flushPromises();
  return wrapper;
}

describe('SkipFiller', () => {
  it('previews, preselects filler, skips per season and undoes exactly those keys', async () => {
    const fillerPreview = vi.fn().mockResolvedValue(response);
    const updateSeasonEpisodes = vi.fn().mockResolvedValue({});
    const wrapper = await open({ fillerPreview, updateSeasonEpisodes });
    expect(fillerPreview).toHaveBeenCalledWith(7, undefined);
    expect(wrapper.get('[data-test="filler-counts"]').text()).toContain('Filler: 3');
    expect(wrapper.find('[data-test="filler-episode-1"]').exists()).toBe(false);
    const watched = wrapper.get('[data-test="filler-episode-4"]');
    expect((watched.element as HTMLInputElement).disabled).toBe(true);
    expect(
      (wrapper.get('[data-test="filler-episode-3"]').element as HTMLInputElement).checked,
    ).toBe(false);
    expect(wrapper.get('[data-test="filler-confirm"]').text()).toBe('Skip 2 episodes');

    await wrapper.get('[data-test="filler-all-mixed"]').setValue(true);
    expect(wrapper.get('[data-test="filler-confirm"]').text()).toBe('Skip 3 episodes');
    await wrapper.get('[data-test="filler-confirm"]').trigger('click');
    await flushPromises();
    expect(updateSeasonEpisodes.mock.calls).toEqual([
      [1, { op: 'skip', keys: ['12', '13'] }],
      [2, { op: 'skip', keys: ['22'] }],
    ]);
    expect(wrapper.emitted('changed')).toHaveLength(1);

    (document.body.querySelector('.undo') as HTMLButtonElement).click();
    await flushPromises();
    expect(updateSeasonEpisodes.mock.calls.slice(2)).toEqual([
      [1, { op: 'unskip', keys: ['12', '13'] }],
      [2, { op: 'unskip', keys: ['22'] }],
    ]);
  });

  it('lets the user paste an address when the show is not found and retries with it', async () => {
    const fillerPreview = vi
      .fn()
      .mockRejectedValueOnce(new ApiRequestError('nope', 404, 'filler_not_found'))
      .mockResolvedValueOnce(response);
    const wrapper = await open({ fillerPreview });
    await wrapper
      .get('[data-test="filler-slug"]')
      .setValue('https://www.animefillerlist.com/shows/show');
    await wrapper.get('[data-test="filler-lookup"]').trigger('submit');
    await flushPromises();
    expect(fillerPreview).toHaveBeenLastCalledWith(7, 'https://www.animefillerlist.com/shows/show');
    expect(wrapper.find('[data-test="filler-confirm"]').exists()).toBe(true);
  });

  it('explains a count mismatch with both counts and offers no apply', async () => {
    const fillerPreview = vi
      .fn()
      .mockRejectedValue(
        new ApiRequestError('x', 409, 'filler_count_mismatch', { ours: 12, theirs: 20 }),
      );
    const wrapper = await open({ fillerPreview });
    const text = wrapper.get('[data-test="filler-problem"]').text();
    expect(text).toContain('12 episodes');
    expect(text).toContain('lists 20');
    expect(wrapper.find('[data-test="filler-confirm"]').exists()).toBe(false);
  });

  it('says so when nothing is left to skip', async () => {
    const fillerPreview = vi.fn().mockResolvedValue({
      ...response,
      episodes: [ep(1, 1, 'mangaCanon'), ep(1, 2, 'filler', true)],
    });
    const wrapper = await open({ fillerPreview });
    expect(wrapper.find('[data-test="filler-nothing"]').exists()).toBe(true);
    expect(
      (wrapper.get('[data-test="filler-confirm"]').element as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
