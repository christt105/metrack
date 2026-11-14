import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { imageRef } from '../src/images/imageRef.js';
import { emptyBook, emptyMovie, emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import type { Repositories } from '../src/storage/repositories/Repositories.js';
import { FixedUserScope } from '../src/users/FixedUserScope.js';
import { createD1Backend } from './support/d1Backend.js';
import type { D1Harness } from './support/D1Harness.js';
import { OWNER_SCOPE } from './support/ownerScope.js';
import { methodsOf, trackCalls } from './support/trackCalls.js';
import type { RecordedStatement } from './support/RecordedStatement.js';

const backend = createD1Backend();

afterAll(() => backend.dispose());

async function exercise(owner: Repositories, friend: Repositories): Promise<void> {
  const hash = 'ab'.repeat(32);
  const created = await owner.users.create({ name: 'Third', email: null });
  await owner.users.get(created.id);
  await owner.users.list();
  await owner.users.setRole(created.id, 'trusted');
  const settings = {
    jellyfinUser: 'j',
    ntfyTopic: null,
    publishProject: null,
    publishBaseUrl: null,
    mirrorDir: null,
    mirrorLinkPrefix: null,
  };
  await owner.settings.save(created.id, settings);
  await owner.settings.get(created.id);
  await owner.settings.list();
  const page = {
    handle: 'third',
    enabled: true,
    avatar: null,
    intro: null,
    description: null,
    about: null,
    giscus: null,
  };
  await owner.profiles.save(created.id, page);
  await owner.profiles.get(created.id);
  await owner.profiles.findByHandle('third');
  await owner.sessions.create({ id: 's', userId: 1, createdAt: 'a', expiresAt: 'b' });
  await owner.sessions.get('s');
  await owner.sessions.deleteExpired('c');
  await owner.sessions.delete('s');
  const token = await owner.apiTokens.create({
    userId: 1,
    name: 't',
    secretHash: 'h',
    scope: 'read',
    createdAt: 'a',
    expiresAt: null,
  });
  await owner.apiTokens.bySecretHash('h');
  await owner.apiTokens.listForUser(1);
  await owner.apiTokens.markUsed(token.id, 'now');
  await owner.apiTokens.delete(1, token.id);

  const movie = await owner.movies.create({ ...emptyMovie(), tmdbId: 1, title: 'M' });
  await friend.movies.create({ ...emptyMovie(), tmdbId: 1, title: 'M' });
  const handMovie = await owner.movies.create({ ...emptyMovie(), title: 'Hand' });
  await owner.movies.get(movie.id);
  await owner.movies.list();
  await owner.movies.listFollowed();
  await owner.movies.findByTmdbId(1);
  await owner.movies.update(movie.id, { rating: 5 });
  await expect(owner.movies.update(movie.id, { originalTitle: 'x' })).rejects.toThrow();
  await owner.movies.updateCatalog(movie.id, { title: 'N' });
  await owner.movies.override(movie.id, { title: 'O' });
  await owner.movies.overriddenFields(movie.id);
  await owner.movies.clearOverride(movie.id, 'title');
  await owner.metadataStates.markFetched('movie', movie.id, 'now');
  await owner.metadataStates.markFetched('movie', movie.id, 'now', 'hash');
  await owner.metadataStates.get('movie', movie.id);
  await owner.metadataStates.unfetched('movie');
  await owner.movies.getMany([movie.id, handMovie.id]);

  const series = await owner.series.create({ ...emptySeries(), tmdbId: 2, tvdbId: 3, title: 'S' });
  await owner.series.findByTmdbId(2);
  await owner.series.findByTvdbId(3);
  await owner.series.listFollowed();
  await owner.series.list();
  const season = await owner.seasons.create({ ...emptySeason(), seriesId: series.id });
  await owner.seasons.listBySeries(series.id);
  await owner.seasons.get(season.id);
  await owner.seasons.getMany([season.id]);
  await owner.seasons.list();
  await owner.overrides.set({
    seriesId: series.id,
    tmdbSeasonNumber: 1,
    number: 1,
    title: null,
    jellyfinSeasonId: null,
  });
  await owner.overrides.listBySeries(series.id);
  await owner.overrides.list();
  await owner.overrides.delete(series.id, 1);

  const game = await owner.videogames.create({ ...emptyBookLike(), igdbId: 4 });
  await owner.videogames.findByIgdbId(4);
  await owner.videogames.findBySteamAppId('7');
  await owner.videogames.list();
  const book = await owner.books.create({ ...emptyBook(), openLibraryId: 'OL1M', isbn: '1' });
  await owner.books.findByOpenLibraryId('OL1M');
  await owner.books.findByIsbn('1');
  await owner.books.list();

  const item = await owner.unlinked.create({
    mediaType: 'movie',
    title: 'U',
    year: null,
    source: 's',
    sourceRef: 'r',
    createdAt: 'now',
  });
  await owner.unlinked.findBySourceRef('s', 'r');
  await owner.unlinked.get(item.id);
  await owner.unlinked.list();
  await owner.unlinked.update(item.id, { title: 'V' });
  await owner.unlinked.delete(item.id);
  await owner.releaseAlerts.record({
    subjectType: 'movie',
    subjectId: movie.id,
    kind: 'releases_today',
    title: 't',
    message: 'm',
    sentAt: 'now',
  });
  await owner.releaseAlerts.keysFor('movie', movie.id);
  await owner.releaseAlerts.allKeys();
  await owner.releaseAlerts.list();

  await owner.images.insert({
    hash,
    ref: imageRef(hash),
    extension: 'png',
    mimeType: 'image/png',
    width: 1,
    height: 1,
    byteSize: 1,
    sourceUrl: 'https://x/a',
    createdAt: 'a',
  });
  await owner.images.get(hash);
  await owner.images.list();
  await owner.images.addSource('https://x/b', hash);
  await owner.images.listSources();
  await owner.images.findBySourceUrl('https://x/b');
  await owner.images.addOwner(hash, created.id, 'a');
  await owner.images.ownerIds(hash);
  await owner.images.ownedBy(created.id);
  await owner.images.usedBytes(created.id);
  await owner.images.orphans('z');
  await owner.images.isShownByCatalog(hash);
  await owner.images.delete(hash);

  const second = await owner.series.create({ ...emptySeries(), tmdbId: 9, title: 'T' });
  const secondSeason = await owner.seasons.create({ ...emptySeason(), seriesId: second.id });
  await owner.seasons.update(secondSeason.id, { rating: 3 });
  await owner.seasons.updateCatalog(secondSeason.id, { title: 'X' });
  await owner.seasons.override(secondSeason.id, { title: 'Y' });
  await owner.seasons.overriddenFields(secondSeason.id);
  await owner.seasons.clearOverride(secondSeason.id, 'title');
  await owner.metadataStates.markFetched('series', second.id, 'now');
  await owner.metadataStates.markFetched('series', second.id, 'now', 'hash');
  await owner.metadataStates.get('series', second.id);
  await owner.metadataStates.unfetched('series');
  await owner.series.getMany([series.id, second.id]);
  await owner.series.get(second.id);
  await owner.series.update(second.id, { note: 'n' });
  await owner.series.updateCatalog(second.id, { title: 'U' });
  await owner.series.override(second.id, { title: 'V' });
  await owner.series.overriddenFields(second.id);
  await owner.series.clearOverride(second.id, 'title');
  await owner.overrides.set({
    seriesId: second.id,
    tmdbSeasonNumber: 1,
    number: 1,
    title: null,
    jellyfinSeasonId: null,
  });
  await owner.videogames.get(game.id);
  await owner.videogames.getMany([game.id]);
  await owner.videogames.update(game.id, { rating: 4 });
  await owner.videogames.updateCatalog(game.id, { title: 'U' });
  await owner.videogames.override(game.id, { title: 'V' });
  await owner.videogames.overriddenFields(game.id);
  await owner.videogames.clearOverride(game.id, 'title');
  await owner.books.get(book.id);
  await owner.books.getMany([book.id]);
  await owner.books.update(book.id, { rating: 4 });
  await owner.books.updateCatalog(book.id, { title: 'U' });
  await owner.books.override(book.id, { title: 'V' });
  await owner.books.overriddenFields(book.id);
  await owner.books.clearOverride(book.id, 'title');
  await owner.metadataStates.markFetched('videogame', game.id, 'now');
  await owner.metadataStates.get('videogame', game.id);
  await owner.metadataStates.markFetched('book', book.id, 'now');
  await owner.metadataStates.get('book', book.id);
  await owner.seasons.delete(secondSeason.id);
  const handBook = await owner.books.create({ ...emptyBook(), title: 'HandBook' });
  await owner.handAddedCatalog.delete('books', handBook.id);
  await owner.books.delete(book.id);
  await owner.series.delete(second.id);

  await owner.handAddedCatalog.listUnreferenced(1);
  await owner.handAddedCatalog.find('movies', handMovie.id);

  await owner.videogames.delete(game.id);
  await owner.series.delete(series.id);
  await owner.movies.delete(movie.id);

  await owner.accounts.requestDeletion(created.id, 'a');
  await owner.accounts.deletionRequestedAt(created.id);
  await owner.accounts.dueForDeletion('z');
  await owner.accounts.cancelDeletion(created.id);
  await owner.accounts.erase(created.id);
  await expect(owner.transactions.run(async () => 1)).rejects.toThrow(
    'no interactive transactions',
  );
}

function emptyBookLike() {
  return {
    igdbId: null,
    steamAppId: null,
    steamGridDbId: null,
    title: 'G',
    releaseDate: null,
    overview: null,
    genres: [],
    developer: null,
    platforms: [],
    note: null,
    cover: null,
    banner: null,
    slug: null,
    tags: [],
    status: 'planned' as const,
    startedAt: null,
    finishedAt: null,
    rating: null,
    review: null,
    rewatches: [],
    pendingReview: false,
  };
}

/**
 * Statements that read a whole table on purpose: scheduled jobs, admin screens and image maintenance, none
 * of them on a request path. Everything else must search an index.
 */
const ACCEPTED_SCANS: { sql: RegExp; scan: RegExp; why: string }[] = [
  { sql: /^SELECT \* FROM user ORDER BY id$/, scan: /^SCAN user/, why: 'admin account list' },
  {
    sql: /^SELECT \* FROM user_setting ORDER BY user_id$/,
    scan: /^SCAN user_setting/,
    why: 'scheduled jobs over every user',
  },
  {
    sql: /^SELECT \* FROM image ORDER BY created_at, hash$/,
    scan: /^SCAN image/,
    why: 'image maintenance',
  },
  {
    sql: /^SELECT url, hash FROM image_source ORDER BY url$/,
    scan: /^SCAN image_source/,
    why: 'image maintenance',
  },
  {
    sql: /^(UPDATE|SELECT) .*json_extract\(overrides, '\$\.(cover|banner)'\)/,
    scan: /^SCAN \w+_entry$/,
    why: 'image deletion and orphan detection read the cover and banner overrides, which live in a JSON column no index covers',
  },
  {
    sql: /^SELECT review FROM \w+_entry WHERE instr/,
    scan: /^SCAN \w+_entry/,
    why: 'orphan detection',
  },
  {
    sql: /^SELECT hash, (source_url, created_at FROM image|url FROM image_source|created_at FROM image_owner)$/,
    scan: /^SCAN image/,
    why: 'orphan detection',
  },
  {
    sql: /^SELECT id, title, owner_id FROM \w+ WHERE owner_id IS NOT NULL/,
    scan: /^SCAN \w+/,
    why: 'admin list of hand-added items; the optional owner filter keeps the planner from the owner_id index',
  },
];

describe('D1 query plans', () => {
  let harness: D1Harness;
  let log: RecordedStatement[];

  beforeEach(async () => {
    harness = (await backend.open()) as D1Harness;
    log = [];
  });

  it('exercises every repository method and none searches without an index or a user filter', async () => {
    const recording = harness.recording(log);
    const friendUser = await harness
      .repositories(OWNER_SCOPE)
      .users.create({ name: 'F', email: null });
    const called = new Set<string>();
    const tracked = (repositories: Repositories): Repositories =>
      Object.fromEntries(
        Object.entries(repositories).map(([name, repository]) => [
          name,
          trackCalls(repository as object, called),
        ]),
      ) as unknown as Repositories;
    const plain = recording.repositories(OWNER_SCOPE);
    const owner = tracked(plain);
    const friend = recording.repositories(new FixedUserScope(friendUser.id));
    await exercise(owner, friend);
    const everyMethod = new Set(
      Object.values(plain).flatMap((repository) => methodsOf(repository as object)),
    );
    expect([...everyMethod].filter((method) => !called.has(method))).toEqual([]);

    const unique = new Map<string, RecordedStatement>();
    for (const entry of log) {
      const sql = entry.sql.replace(/\s+/g, ' ').trim();
      if (!sql.startsWith('PRAGMA')) unique.set(sql, { sql, params: entry.params });
    }
    expect(unique.size).toBeGreaterThan(80);

    const unexpected: string[] = [];
    const usedAcceptances = new Set<string>();
    for (const { sql, params } of unique.values()) {
      const plan = await harness.explain(sql, ...params);
      for (const line of plan.filter((detail) => /^SCAN (?!CONSTANT ROW)/.test(detail))) {
        const accepted = ACCEPTED_SCANS.find((a) => a.sql.test(sql) && a.scan.test(line));
        if (accepted) usedAcceptances.add(accepted.why + accepted.sql.source);
        else unexpected.push(`${line}  <=  ${sql}`);
      }
    }
    expect(unexpected).toEqual([]);
    expect(
      ACCEPTED_SCANS.filter((a) => !usedAcceptances.has(a.why + a.sql.source)).map(
        (a) => a.sql.source,
      ),
    ).toEqual([]);
  }, 60_000);
});
