import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import UnmatchedEpisodes from '../src/components/UnmatchedEpisodes.vue';

const unmatched = [
  { code: 'episode_unmatched' as const, season: 1, number: 2, name: 'Pilot' },
  { code: 'episode_other_series' as const, season: 1, number: 3, name: null, tmdbSeriesId: 9 },
];

describe('UnmatchedEpisodes', () => {
  it('lists the episodes by season with links to TMDB', () => {
    const wrapper = mount(UnmatchedEpisodes, {
      props: { unmatched, tmdbId: 77, knownSeasons: [1] },
    });
    expect(wrapper.text()).toContain('2 watched episodes could not be recorded');
    expect(wrapper.text()).toContain('E2 Pilot');
    const links = wrapper.findAll('a').map((a) => a.attributes('href'));
    expect(links).toEqual([
      'https://www.themoviedb.org/tv/77/season/1',
      'https://www.themoviedb.org/tv/9',
    ]);
  });

  it('shows nothing for an empty list or another season', () => {
    expect(
      mount(UnmatchedEpisodes, { props: { unmatched: [], tmdbId: 77, knownSeasons: [] } }).html(),
    ).toBe('<!--v-if-->');
    expect(
      mount(UnmatchedEpisodes, {
        props: { unmatched, tmdbId: 77, knownSeasons: [2], only: 2 },
      }).text(),
    ).toBe('');
  });
});
