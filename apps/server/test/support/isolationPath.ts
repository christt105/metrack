import type { IsolationWorld } from './IsolationWorld.js';

const IDS_BY_SEGMENT: Readonly<Record<string, (world: IsolationWorld) => number | string>> = {
  movies: (world) => world.movieId,
  movie: (world) => world.movieId,
  series: (world) => world.seriesId,
  seasons: (world) => world.seasonId,
  games: (world) => world.gameId,
  books: (world) => world.bookId,
  unlinked: (world) => world.unlinkedId,
  tokens: (world) => world.tokenId,
  invites: (world) => world.inviteId,
  users: () => 1,
};

const NAMED: Readonly<Record<string, (world: IsolationWorld) => number | string>> = {
  kind: () => 'cover',
  field: () => 'title',
  date: () => '2026-01-01',
  hash: (world) => world.imageHash,
  collection: () => 'series',
  type: () => 'movie',
  titleId: (world) => world.movieId,
};

/** Fills the params of a route pattern with user 1's ids; throws when it cannot tell what a param stands for. */
export function isolationPath(pattern: string, world: IsolationWorld): string {
  const segments = pattern.split('/');
  const values: string[] = [];
  const filled = segments.map((segment, index) => {
    if (!segment.startsWith(':')) {
      values.push(segment);
      return segment;
    }
    const name = segment.slice(1);
    let value: number | string | undefined;
    if (name === 'id') {
      const owner = values[index - 1];
      value = owner === undefined ? undefined : IDS_BY_SEGMENT[owner]?.(world);
    } else {
      value = NAMED[name]?.(world);
    }
    if (value === undefined) {
      throw new Error(`Teach isolationPath what ${segment} stands for in ${pattern}`);
    }
    values.push(String(value));
    return String(value);
  });
  return filled.join('/');
}
