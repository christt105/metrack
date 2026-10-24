import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Movie } from '@metrack/domain';
import { ImageStore } from '../src/images/ImageStore.js';
import { MetadataCache } from '../src/metadata/MetadataCache.js';
import { MetadataStateRepository } from '../src/metadata/MetadataStateRepository.js';
import { movieLifecycle } from '../src/metadata/movieLifecycle.js';
import type { MetadataSource } from '../src/metadata/MetadataSource.js';
import type { ProviderMetadata } from '../src/metadata/ProviderMetadata.js';
import { MovieRepository } from '../src/storage/repositories/index.js';
import { fakeFetch } from './support/fakeFetch.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { png } from './support/sampleImages.js';

class ScriptedSource implements MetadataSource<Movie> {
  calls = 0;
  failWith: Error | null = null;
  constructor(public next: ProviderMetadata<Movie>) {}
  fetch(): Promise<ProviderMetadata<Movie>> {
    this.calls += 1;
    return this.failWith ? Promise.reject(this.failWith) : Promise.resolve(this.next);
  }
}

const COVER_URL = 'https://img.test/poster.png';
let clock: Date;
let movies: MovieRepository;
let states: MetadataStateRepository;
let images: ImageStore;
let source: ScriptedSource;
let cache: MetadataCache;
let movieId: number;

beforeEach(() => {
  const db = openTestDatabase();
  clock = new Date('2026-10-24T12:00:00Z');
  movies = new MovieRepository(db);
  states = new MetadataStateRepository(db);
  const net = fakeFetch({ [COVER_URL]: png(600, 900) });
  images = new ImageStore(
    db,
    join(mkdtempSync(join(tmpdir(), 'metrack-cache-')), 'images'),
    net.fetch,
  );
  source = new ScriptedSource({
    fields: { overview: 'Plot', genres: ['Drama'] },
    coverUrl: COVER_URL,
  });
  cache = new MetadataCache(states, images, undefined, () => clock);
  cache.register('movie', { repository: movies, source, lifecycle: movieLifecycle });
  movieId = db
    .prepare('INSERT INTO movie (title, release_date) VALUES (?, ?)')
    .run('Old', '2015-01-01').lastInsertRowid as number;
  movieId = Number(movieId);
});

const advanceDays = (days: number) => {
  clock = new Date(clock.getTime() + days * 86_400_000);
};

describe('MetadataCache', () => {
  it('fills a never fetched entity and points the cover at the local copy', async () => {
    const result = await cache.refresh('movie', movieId);
    expect(result).toEqual({
      outcome: 'updated',
      fields: expect.arrayContaining(['overview', 'genres', 'cover']),
    });
    const movie = movies.get(movieId) as Movie;
    expect(movie.overview).toBe('Plot');
    expect(movie.cover).toMatch(/^\/api\/images\/[0-9a-f]{64}$/);
    expect(images.list()).toHaveLength(1);
    expect(states.get('movie', movieId)).toMatchObject({ fetchedAt: clock.toISOString() });
  });

  it('does not ask the provider again until the entry expires', async () => {
    await cache.refresh('movie', movieId);
    advanceDays(10);
    expect(await cache.refresh('movie', movieId)).toEqual({ outcome: 'fresh' });
    expect(source.calls).toBe(1);
    advanceDays(25);
    await cache.refresh('movie', movieId);
    expect(source.calls).toBe(2);
  });

  it('writes nothing when the content hash is unchanged, only moves fetched_at', async () => {
    await cache.refresh('movie', movieId);
    const before = states.get('movie', movieId);
    advanceDays(40);
    expect(await cache.refresh('movie', movieId)).toEqual({ outcome: 'unchanged' });
    const after = states.get('movie', movieId);
    expect(after.metadataHash).toBe(before.metadataHash);
    expect(after.fetchedAt).toBe(clock.toISOString());
  });

  it('manual refresh ignores expiry', async () => {
    await cache.refresh('movie', movieId);
    source.next = { fields: { overview: 'New plot', genres: ['Drama'] }, coverUrl: COVER_URL };
    expect(await cache.refresh('movie', movieId, true)).toEqual({
      outcome: 'updated',
      fields: ['overview'],
    });
    expect(movies.get(movieId)?.overview).toBe('New plot');
  });

  it('never overwrites fields marked as edited', async () => {
    movies.update(movieId, { overview: 'My own summary' });
    states.markEdited('movie', movieId, 'overview');
    await cache.refresh('movie', movieId);
    const movie = movies.get(movieId) as Movie;
    expect(movie.overview).toBe('My own summary');
    expect(movie.genres).toEqual(['Drama']);
    states.unmarkEdited('movie', movieId, 'overview');
    expect(states.get('movie', movieId).editedFields).toEqual([]);
  });

  it('keeps stored data when the provider fails', async () => {
    await cache.refresh('movie', movieId);
    source.failWith = new Error('TMDB down');
    expect(await cache.refresh('movie', movieId, true)).toEqual({
      outcome: 'failed',
      error: 'TMDB down',
    });
    expect(movies.get(movieId)?.overview).toBe('Plot');
  });

  it('retries an image that failed to download on the next refresh', async () => {
    source.next = { fields: { overview: 'Plot' }, coverUrl: 'https://img.test/missing.png' };
    await cache.refresh('movie', movieId);
    expect(movies.get(movieId)?.cover).toBeNull();
    expect(states.get('movie', movieId).metadataHash).toBeNull();
    source.next = { fields: { overview: 'Plot' }, coverUrl: COVER_URL };
    await cache.refresh('movie', movieId, true);
    expect(movies.get(movieId)?.cover).not.toBeNull();
  });

  it('rejects unregistered types and unknown ids', async () => {
    await expect(cache.refresh('book', 1)).rejects.toThrow('No metadata source');
    await expect(cache.refresh('movie', 999)).rejects.toThrow('not found');
  });
});
