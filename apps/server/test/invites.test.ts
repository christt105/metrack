import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { InviteService } from '../src/invites/InviteService.js';
import type { InviteRedemption } from '../src/storage/repositories/InviteRedemption.js';
import type { Repositories } from '../src/storage/repositories/Repositories.js';
import { createBackends } from './support/backends.js';
import { OWNER_SCOPE } from './support/ownerScope.js';
import type { StorageHarness } from './support/StorageHarness.js';

const NOW = new Date('2026-11-15T12:00:00.000Z');
const DAY_MS = 24 * 3_600_000;

const backends = createBackends();

afterAll(async () => {
  for (const backend of backends) await backend.dispose();
});

function joiner(codeHash: string, n: number, at = NOW): InviteRedemption {
  return {
    codeHash,
    name: `Friend ${n}`,
    email: `friend${n}@example.com`,
    googleSub: `sub-${n}`,
    at: at.toISOString(),
  };
}

describe.each(backends)('$name invitations', (backend) => {
  let harness: StorageHarness;
  let repos: Repositories;
  let clock: Date;
  let service: InviteService;

  beforeEach(async () => {
    harness = await backend.open();
    repos = harness.repositories(OWNER_SCOPE);
    clock = NOW;
    service = new InviteService(repos.invites, repos.users, () => clock);
  });

  async function hashOf(id: number): Promise<string> {
    return String(
      (await harness.query('SELECT code_hash FROM invite WHERE id = ?', id))[0]?.code_hash,
    );
  }

  it('stores only the hash of the code and expires after seven days by default', async () => {
    const { invite, code } = await service.create({ maxUses: 1 });
    expect(code.length).toBeGreaterThanOrEqual(32);
    const stored = await harness.query('SELECT * FROM invite');
    expect(JSON.stringify(stored)).not.toContain(code);
    expect(invite).toMatchObject({
      maxUses: 1,
      uses: 0,
      status: 'valid',
      expiresAt: new Date(NOW.getTime() + 7 * DAY_MS).toISOString(),
      usedBy: [],
    });
  });

  it('lets the owner choose the expiry and rejects values out of range', async () => {
    const { invite } = await service.create({ maxUses: 3, expiresInDays: 2 });
    expect(invite.expiresAt).toBe(new Date(NOW.getTime() + 2 * DAY_MS).toISOString());
    await expect(service.create({ maxUses: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(service.create({ maxUses: 1.5 })).rejects.toMatchObject({ status: 400 });
    await expect(service.create({ maxUses: 101 })).rejects.toMatchObject({ status: 400 });
    await expect(service.create({ maxUses: 1, expiresInDays: 0 })).rejects.toMatchObject({
      status: 400,
    });
    await expect(service.create({ maxUses: 1, expiresInDays: 91 })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('previews a valid link with the owner name and spends nothing', async () => {
    const { code, invite } = await service.create({ maxUses: 1 });
    expect(await service.preview(code)).toEqual({ status: 'valid', inviter: 'Owner' });
    expect(await service.preview(code)).toEqual({ status: 'valid', inviter: 'Owner' });
    expect((await service.list())[0]?.uses).toBe(0);
    expect(invite.uses).toBe(0);
    expect(await service.preview('not-a-code')).toEqual({ status: 'unknown', inviter: 'Owner' });
  });

  it('redeems a valid invitation into a normal user with the verified email, and records the use', async () => {
    const { invite } = await service.create({ maxUses: 1 });
    const user = await repos.invites.redeem(joiner(await hashOf(invite.id), 1));
    expect(user).toMatchObject({ name: 'Friend 1', email: 'friend1@example.com', role: 'normal' });
    expect(await repos.users.isWelcomed(user!.id)).toBe(false);
    const [listed] = await service.list();
    expect(listed).toMatchObject({ uses: 1, status: 'used_up' });
    expect(listed?.usedBy).toEqual([
      { userId: user!.id, userName: 'Friend 1', usedAt: NOW.toISOString() },
    ]);
  });

  it('refuses a used-up invitation and creates nothing', async () => {
    const { invite } = await service.create({ maxUses: 1 });
    const hash = await hashOf(invite.id);
    await repos.invites.redeem(joiner(hash, 1));
    expect(await repos.invites.redeem(joiner(hash, 2))).toBeUndefined();
    expect((await repos.users.list()).map((user) => user.name)).toEqual(['Owner', 'Friend 1']);
    expect((await service.list())[0]?.uses).toBe(1);
  });

  it('refuses an expired invitation', async () => {
    const { invite, code } = await service.create({ maxUses: 2, expiresInDays: 1 });
    clock = new Date(NOW.getTime() + 2 * DAY_MS);
    expect((await service.preview(code)).status).toBe('expired');
    expect(await repos.invites.redeem(joiner(await hashOf(invite.id), 1, clock))).toBeUndefined();
    expect(await repos.users.list()).toHaveLength(1);
  });

  it('refuses a revoked invitation and cannot revoke one that is used up or already revoked', async () => {
    const first = await service.create({ maxUses: 2 });
    expect(await service.revoke(first.invite.id)).toBe(true);
    expect(await service.revoke(first.invite.id)).toBe(false);
    expect((await service.preview(first.code)).status).toBe('revoked');
    expect(await repos.invites.redeem(joiner(await hashOf(first.invite.id), 1))).toBeUndefined();

    const second = await service.create({ maxUses: 1 });
    await repos.invites.redeem(joiner(await hashOf(second.invite.id), 2));
    expect(await service.revoke(second.invite.id)).toBe(false);
    expect(await service.revoke(9999)).toBe(false);
    expect(await repos.users.list()).toHaveLength(2);
  });

  it('lets a multi-use invitation admit several people and records each one', async () => {
    const { invite, code } = await service.create({ maxUses: 3 });
    const hash = await hashOf(invite.id);
    for (const n of [1, 2]) expect(await repos.invites.redeem(joiner(hash, n))).toBeDefined();
    expect((await service.preview(code)).status).toBe('valid');
    expect(await repos.invites.redeem(joiner(hash, 3))).toBeDefined();
    expect((await service.preview(code)).status).toBe('used_up');
    expect(await repos.invites.redeem(joiner(hash, 4))).toBeUndefined();
    const [listed] = await service.list();
    expect(listed?.usedBy.map((use) => use.userName)).toEqual(['Friend 1', 'Friend 2', 'Friend 3']);
  });

  it('creates exactly one user when two people race for the last use', async () => {
    const { invite } = await service.create({ maxUses: 1 });
    const hash = await hashOf(invite.id);
    const results = await Promise.all([
      repos.invites.redeem(joiner(hash, 1)),
      repos.invites.redeem(joiner(hash, 2)),
      repos.invites.redeem(joiner(hash, 3)),
    ]);
    expect(results.filter((user) => user !== undefined)).toHaveLength(1);
    expect(await repos.users.list()).toHaveLength(2);
    expect((await service.list())[0]).toMatchObject({ uses: 1 });
    expect((await service.list())[0]?.usedBy).toHaveLength(1);
    expect(await harness.query('SELECT * FROM invite_use')).toHaveLength(1);
  });

  it('rolls everything back when the email already belongs to a user', async () => {
    const { invite } = await service.create({ maxUses: 2 });
    const hash = await hashOf(invite.id);
    await repos.users.create({ name: 'Taken', email: 'friend1@example.com' });
    await expect(repos.invites.redeem(joiner(hash, 1))).rejects.toThrow();
    expect((await service.list())[0]).toMatchObject({ uses: 0, usedBy: [] });
  });

  it('keeps the use but forgets the user when the account is erased', async () => {
    const { invite } = await service.create({ maxUses: 2 });
    const user = await repos.invites.redeem(joiner(await hashOf(invite.id), 1));
    await repos.accounts.erase(user!.id);
    const [listed] = await service.list();
    expect(listed).toMatchObject({ uses: 1 });
    expect(listed?.usedBy).toEqual([{ userId: null, userName: null, usedAt: NOW.toISOString() }]);
  });

  it('marks existing users as welcomed and lets a new one confirm their name', async () => {
    const created = await repos.users.create({ name: 'Hand made', email: null });
    expect(await repos.users.isWelcomed(created.id)).toBe(true);
    const { invite } = await service.create({ maxUses: 1 });
    const user = await repos.invites.redeem(joiner(await hashOf(invite.id), 1));
    await repos.users.completeWelcome(user!.id, 'Chosen', NOW.toISOString());
    expect(await repos.users.isWelcomed(user!.id)).toBe(true);
    expect((await repos.users.get(user!.id))?.name).toBe('Chosen');
    expect((await repos.users.createdAtByUser()).get(user!.id)).toBe(NOW.toISOString());
  });
});
