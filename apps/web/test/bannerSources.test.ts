import { describe, expect, it } from 'vitest';
import { bannerSources } from '../src/logic/bannerSources';

describe('bannerSources', () => {
  it('offers the two TMDB sizes', () => {
    const sources = bannerSources('https://image.tmdb.org/t/p/original/a.jpg');
    expect(sources.src).toBe('https://image.tmdb.org/t/p/w1280/a.jpg');
    expect(sources.srcset).toBe(
      'https://image.tmdb.org/t/p/w780/a.jpg 780w, https://image.tmdb.org/t/p/w1280/a.jpg 1280w',
    );
  });

  it('keeps a stored image as it is, without a srcset', () => {
    expect(bannerSources('/api/images/abc')).toEqual({ src: '/api/images/abc', srcset: undefined });
  });
});
