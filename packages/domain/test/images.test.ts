import { describe, expect, it } from 'vitest';
import { canUseOwnArtwork, isLinkedImageUrl, sizedImageUrl } from '../src/index.js';

describe('isLinkedImageUrl', () => {
  it.each([
    'https://image.tmdb.org/t/p/original/1BnJfeJMcpXdh1XYQSd9LuomeZA.jpg',
    'https://images.igdb.com/igdb/image/upload/t_720p/sclpy8.webp',
    'https://cdn.cloudflare.steamstatic.com/steam/apps/17410/library_600x900_2x.jpg',
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/header.jpg',
  ])('links %s', (url) => {
    expect(isLinkedImageUrl(url)).toBe(true);
  });

  it.each([
    'https://cdn2.steamgriddb.com/grid/0230061ed918ad8c48635cd123e28eff.png',
    'https://artworks.thetvdb.com/banners/series/370761/backgrounds/62025943.jpg',
    'https://covers.openlibrary.org/b/id/1-L.jpg',
    'http://image.tmdb.org/t/p/original/a.jpg',
    'https://evilsteamstatic.com/a.jpg',
    '/api/images/abc',
    'not a url',
  ])('copies %s', (url) => {
    expect(isLinkedImageUrl(url)).toBe(false);
  });
});

describe('sizedImageUrl', () => {
  it('asks TMDB and IGDB for the size each display needs', () => {
    const tmdb = 'https://image.tmdb.org/t/p/original/poster.jpg';
    expect(sizedImageUrl(tmdb, 'thumb')).toBe('https://image.tmdb.org/t/p/w342/poster.jpg');
    expect(sizedImageUrl(tmdb, 'banner')).toBe('https://image.tmdb.org/t/p/w1280/poster.jpg');
    const igdb = 'https://images.igdb.com/igdb/image/upload/t_720p/sclpy8.webp';
    expect(sizedImageUrl(igdb, 'thumb')).toBe(
      'https://images.igdb.com/igdb/image/upload/t_cover_big/sclpy8.webp',
    );
  });

  it('leaves stored copies and Steam art alone', () => {
    const steam = 'https://cdn.cloudflare.steamstatic.com/steam/apps/17410/library_600x900_2x.jpg';
    expect(sizedImageUrl(steam, 'thumb')).toBe(steam);
    expect(sizedImageUrl('/api/images/abc', 'banner')).toBe('/api/images/abc');
  });
});

describe('canUseOwnArtwork', () => {
  it('is for the owner and trusted users only', () => {
    expect(canUseOwnArtwork('owner')).toBe(true);
    expect(canUseOwnArtwork('trusted')).toBe(true);
    expect(canUseOwnArtwork('normal')).toBe(false);
  });
});
