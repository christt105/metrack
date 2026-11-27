import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MemoryContentVersions } from '../src/site/MemoryContentVersions.js';
import { D1ContentVersions } from '../src/storage/d1/D1ContentVersions.js';
import type { D1Database } from '../src/storage/d1/D1Database.js';
import { applyD1Migrations } from './support/d1Migrations.js';

describe('MemoryContentVersions.global', () => {
  it('adds the counters of every user to the base', async () => {
    const versions = new MemoryContentVersions(1000);
    expect(await versions.global()).toEqual({ total: 1000, users: 0 });
    await versions.bump(1);
    await versions.bump(1);
    await versions.bump(2);
    expect(await versions.global()).toEqual({ total: 1003, users: 2 });
  });

  it('starts from a different base after a restart', async () => {
    const totals = new Set<number>();
    for (let i = 0; i < 20; i += 1) totals.add((await new MemoryContentVersions().global()).total);
    expect(totals.size).toBeGreaterThan(1);
  });
});

describe('D1ContentVersions.global', () => {
  let miniflare: Miniflare;
  let db: D1Database;

  beforeAll(async () => {
    miniflare = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response(null); } };',
      d1Databases: { DB: 'metrack-content-versions' },
    });
    db = (await miniflare.getD1Database('DB')) as unknown as D1Database;
    await applyD1Migrations(db);
  });

  afterAll(async () => {
    await miniflare.dispose();
  });

  it('sums the counters and counts the users in one query', async () => {
    const versions = new D1ContentVersions(db);
    expect(await versions.global()).toEqual({ total: 0, users: 0 });
    for (const id of [1, 2]) {
      await db
        .prepare(`INSERT INTO user (id, name, created_at) VALUES (${id}, 'U${id}', '2026-01-01')`)
        .run();
    }
    await versions.bump(1);
    await versions.bump(1);
    await versions.bump(2);
    expect(await versions.global()).toEqual({ total: 3, users: 2 });
    await db.prepare('DELETE FROM user WHERE id = 2').run();
    expect(await versions.global()).toEqual({ total: 2, users: 1 });
  });
});
