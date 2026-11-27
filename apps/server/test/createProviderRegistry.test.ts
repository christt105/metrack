import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import { SteamGridDbImageProvider } from '../src/artwork/SteamGridDbImageProvider.js';
import { createImageStore } from '../src/images/createImageStore.js';
import { createProviderRegistry } from '../src/providers/createProviderRegistry.js';
import { IgdbClient } from '../src/providers/igdb/IgdbClient.js';
import { SteamGridDbClient } from '../src/providers/steamgriddb/SteamGridDbClient.js';
import { createSqliteRepositories } from '../src/storage/sqlite/createSqliteRepositories.js';
import { IgdbGameProvider } from '../src/titles/IgdbGameProvider.js';
import { fakeFetch } from './support/fakeFetch.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { OWNER_SCOPE } from './support/ownerScope.js';

describe('createProviderRegistry', () => {
  it.each([
    {
      label: 'with TMDB credentials',
      apiKey: 'test-key',
      tmdbProvider: 'tmdb',
      imageNames: ['tmdb', 'steamgriddb', 'openlibrary'],
    },
    {
      label: 'without TMDB credentials',
      apiKey: undefined,
      tmdbProvider: undefined,
      imageNames: ['steamgriddb', 'openlibrary'],
    },
  ])('registers providers $label', ({ apiKey, tmdbProvider, imageNames }) => {
    const db = openTestDatabase();
    const dir = mkdtempSync(join(tmpdir(), 'metrack-provider-registry-'));
    onTestFinished(() => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    });
    const repositories = createSqliteRepositories(db, OWNER_SCOPE);
    const { fetch } = fakeFetch({});
    const imageStore = createImageStore(db, dir, fetch);
    const steamGridDb = new SteamGridDbClient(fetch, 'test-token');
    const igdb = new IgdbClient(fetch, { clientId: 'test-id', clientSecret: 'test-secret' });

    const { metadataCache, titleProviders, imageProviders } = createProviderRegistry(
      { tmdbApiKey: apiKey, tmdbLanguage: 'es-ES', openLibraryLanguage: 'es' },
      fetch,
      repositories,
      imageStore,
      {
        title: new IgdbGameProvider(
          igdb,
          repositories.videogames,
          imageStore,
          steamGridDb,
          repositories.gameArtwork,
        ),
        image: new SteamGridDbImageProvider(steamGridDb),
      },
    );

    expect(titleProviders.get('movie')?.provider).toBe(tmdbProvider);
    expect(titleProviders.get('series')?.provider).toBe(tmdbProvider);
    expect(titleProviders.get('videogame')?.provider).toBe('igdb');
    expect(titleProviders.get('book')?.provider).toBe('openlibrary');
    expect(imageProviders.map((provider) => provider.name)).toEqual(imageNames);
    expect(metadataCache.supports('movie')).toBe(Boolean(apiKey));
    expect(metadataCache.supports('series')).toBe(Boolean(apiKey));
  });
});
