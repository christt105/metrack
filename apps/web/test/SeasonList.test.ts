import { describe, expect, it } from 'vitest';
import type { Season } from '@metrack/domain';
import SeasonList from '../src/components/SeasonList.vue';
import { mountWithApi } from './mountWithApi';

const season = (over: Partial<Season>): Season =>
  ({
    id: 1,
    number: 1,
    title: null,
    cover: null,
    status: 'completed',
    rating: null,
    pendingReview: false,
    episodeCount: 10,
    skippedCount: 0,
    ...over,
  }) as Season;

describe('SeasonList', () => {
  it('shows a season rating as its word, never as a score out of ten', async () => {
    const { wrapper } = await mountWithApi(SeasonList, {}, { seasons: [season({ rating: 6 })] });
    const rating = wrapper.find('.rating');
    expect(rating.exists()).toBe(true);
    expect(rating.text()).not.toMatch(/\d/);
    expect(wrapper.text()).not.toContain('/10');
  });

  it('shows no rating for an unrated season', async () => {
    const { wrapper } = await mountWithApi(SeasonList, {}, { seasons: [season({})] });
    expect(wrapper.find('.rating').exists()).toBe(false);
  });
});
