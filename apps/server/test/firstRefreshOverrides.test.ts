import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Movie } from '@metrack/domain';
import type { ImageStore } from '../src/images/ImageStore.js';
import { imageRef } from '../src/images/imageRef.js';
import { emptyMovie } from '../src/media/emptyEntities.js';
import { MetadataCache } from '../src/metadata/MetadataCache.js';
import { movieLifecycle } from '../src/metadata/movieLifecycle.js';
import type { MetadataSource } from '../src/metadata/MetadataSource.js';
import type { ProviderMetadata } from '../src/metadata/ProviderMetadata.js';
import type { Repositories } from '../src/storage/repositories/Repositories.js';
import { FixedUserScope } from '../src/users/FixedUserScope.js';
import { createBackends } from './support/backends.js';
import { OWNER_SCOPE } from './support/ownerScope.js';
import type { StorageHarness } from './support/StorageHarness.js';

class ScriptedSource implements MetadataSource<Movie> {
  constructor(public next: ProviderMetadata<Movie>) {}
  fetch(): Promise<ProviderMetadata<Movie>> {
    return Promise.resolve(this.next);
  }
}

const OWN_HASH = 'a'.repeat(64);
const PROVIDER_COVER = 'https://image.tmdb.org/t/p/original/poster.jpg';
const referenceAsIs = { reference: async (url: string) => url } as unknown as ImageStore;

const pick = (movie: Movie | undefined) => ({
  title: movie?.title,
  overview: movie?.overview,
  releaseDate: movie?.releaseDate,
  cover: movie?.cover,
});

const backends = createBackends();

afterAll(async () => {
  for (const backend of backends) await backend.dispose();
});

describe.each(backends)('$name: first metadata refresh of imported titles', (backend) => {
  let harness: StorageHarness;
  let repos: Repositories;
  let friend: Repositories;
  let source: ScriptedSource;
  let cache: MetadataCache;
  let clock: Date;
  let movieId: number;

  const refreshAs = (repositories: Repositories) => {
    const scoped = new MetadataCache(
      repositories.metadataStates,
      referenceAsIs,
      undefined,
      () => clock,
    );
    scoped.register('movie', {
      repository: repositories.movies,
      source,
      lifecycle: movieLifecycle,
    });
    return scoped;
  };

  beforeEach(async () => {
    harness = await backend.open();
    repos = harness.repositories(OWNER_SCOPE);
    clock = new Date('2026-11-15T12:00:00Z');
    source = new ScriptedSource({
      fields: {
        title: 'Crímenes',
        overview: 'Provider plot',
        releaseDate: '2024-05-01',
        genres: ['Crime'],
      },
      coverUrl: PROVIDER_COVER,
    });
    cache = refreshAs(repos);
    const imported = await repos.movies.create({
      ...emptyMovie(),
      tmdbId: 7,
      title: 'Crims',
      overview: 'My plot',
      releaseDate: '2024-04-30',
      cover: imageRef(OWN_HASH),
    });
    movieId = imported.id;
  });

  it('keeps the imported values for the user and gives the catalog the provider values', async () => {
    expect(await cache.refresh('movie', movieId)).toMatchObject({ outcome: 'updated' });

    expect(await repos.movies.get(movieId)).toMatchObject({
      title: 'Crims',
      overview: 'My plot',
      releaseDate: '2024-04-30',
      cover: imageRef(OWN_HASH),
      genres: ['Crime'],
    });
    expect((await repos.movies.overriddenFields(movieId)).sort()).toEqual([
      'cover',
      'overview',
      'releaseDate',
      'title',
    ]);
    const [catalog] = await harness.query(
      'SELECT title, overview, cover FROM movie WHERE id = ?',
      movieId,
    );
    expect(catalog).toMatchObject({
      title: 'Crímenes',
      overview: 'Provider plot',
      cover: PROVIDER_COVER,
    });
  });

  it('changes nothing for the user on later refreshes', async () => {
    await cache.refresh('movie', movieId);
    const before = pick(await repos.movies.get(movieId));
    source.next = { fields: { genres: ['Crime', 'Drama'] }, coverUrl: PROVIDER_COVER };
    clock = new Date('2027-01-15T12:00:00Z');
    await cache.refresh('movie', movieId, true);

    expect(pick(await repos.movies.get(movieId))).toEqual(before);
    const [catalog] = await harness.query('SELECT genres FROM movie WHERE id = ?', movieId);
    expect(JSON.parse(String(catalog?.genres))).toEqual(['Crime', 'Drama']);
  });

  it('pins the values of every user who has the title and leaves existing overrides alone', async () => {
    await repos.users.create({ name: 'Friend', email: null });
    friend = harness.repositories(new FixedUserScope(2));
    await friend.movies.create({ ...emptyMovie(), tmdbId: 7, title: 'Crims' });
    await friend.movies.override(movieId, { overview: 'Friend plot' });

    await cache.refresh('movie', movieId);

    expect(await friend.movies.get(movieId)).toMatchObject({
      title: 'Crims',
      overview: 'Friend plot',
      cover: imageRef(OWN_HASH),
    });
  });

  it('keeps today behaviour for a row that was fetched before', async () => {
    await harness.run(
      "UPDATE movie SET fetched_at = '2026-01-01T00:00:00.000Z' WHERE id = ?",
      movieId,
    );
    await cache.refresh('movie', movieId, true);

    expect(await repos.movies.overriddenFields(movieId)).toEqual([]);
    expect(await repos.movies.get(movieId)).toMatchObject({
      title: 'Crímenes',
      overview: 'Provider plot',
      cover: PROVIDER_COVER,
    });
  });

  it('does not pin empty stored values or values equal to the provider', async () => {
    const bare = await repos.movies.create({
      ...emptyMovie(),
      tmdbId: 8,
      title: 'Crímenes',
      genres: [],
    });
    await cache.refresh('movie', bare.id);
    expect(await repos.movies.overriddenFields(bare.id)).toEqual([]);
  });

  it('keeps the replaced images referenced so the cleanup does not remove them', async () => {
    await repos.images.insert({
      hash: OWN_HASH,
      ref: imageRef(OWN_HASH),
      extension: 'png',
      mimeType: 'image/png',
      width: 10,
      height: 20,
      byteSize: 100,
      sourceUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await cache.refresh('movie', movieId);

    expect(await repos.images.orphans()).not.toContain(OWN_HASH);
  });
});
