import { describe, expect, it } from 'vitest';
import MediaCard from '../src/components/MediaCard.vue';
import type { LibraryCard } from '../src/logic/buildCards';
import { mountWithApi } from './mountWithApi';

const card = (over: Partial<LibraryCard>): LibraryCard => ({
  key: 'videogame-1',
  type: 'videogame',
  id: 1,
  title: 'Hades',
  subtitle: null,
  cover: null,
  banner: null,
  status: null,
  rating: null,
  seasonCount: null,
  pendingReview: false,
  allAchievements: false,
  watching: false,
  ...over,
});

describe('MediaCard', () => {
  it('shows the trophy only for a game with every achievement', async () => {
    const complete = await mountWithApi(MediaCard, {}, { card: card({ allAchievements: true }) });
    const badge = complete.wrapper.find('[data-test="all-achievements"]');
    expect(badge.exists()).toBe(true);
    expect(badge.attributes('title')).toBe('All achievements');
    expect(badge.attributes('aria-label')).toBe('All achievements');
    const other = await mountWithApi(MediaCard, {}, { card: card({}) });
    expect(other.wrapper.find('[data-test="all-achievements"]').exists()).toBe(false);
  });
});
