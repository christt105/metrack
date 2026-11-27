import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Invite } from '@metrack/domain';
import InvitationsPanel from '../src/components/InvitationsPanel.vue';
import { mountWithApi } from './mountWithApi';

const valid: Invite = {
  id: 1,
  maxUses: 3,
  uses: 1,
  createdAt: '2026-11-15T12:00:00.000Z',
  expiresAt: '2026-11-22T12:00:00.000Z',
  revokedAt: null,
  status: 'valid',
  usedBy: [{ userId: 5, userName: 'Ana', usedAt: '2026-11-16T10:00:00.000Z' }],
};
const spent: Invite = { ...valid, id: 2, uses: 3, status: 'used_up', usedBy: [] };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('InvitationsPanel', () => {
  it('lists the links with uses spent and who used them, and offers revoke only while valid', async () => {
    const { wrapper } = await mountWithApi(InvitationsPanel, {
      admin: { listInvites: vi.fn().mockResolvedValue([valid, spent]) },
    });
    await flushPromises();
    const items = wrapper.findAll('[data-test="invite"]');
    expect(items).toHaveLength(2);
    expect(items[0]?.text()).toContain('1 of 3 used · expires 2026-11-22');
    expect(items[0]?.text()).toContain('Ana (2026-11-16)');
    expect(items[0]?.find('button').exists()).toBe(true);
    expect(items[1]?.text()).toContain('All uses spent');
    expect(items[1]?.find('button').exists()).toBe(false);
  });

  it('creates a link with the chosen uses and expiry and shows the full URL once', async () => {
    const createInvite = vi.fn().mockResolvedValue({ invite: valid, code: 'abc123' });
    const listInvites = vi.fn().mockResolvedValue([]);
    const { wrapper } = await mountWithApi(InvitationsPanel, {
      admin: { listInvites, createInvite },
    });
    await flushPromises();
    await wrapper.find('input[name="maxUses"]').setValue(5);
    await wrapper.find('select[name="expiresInDays"]').setValue('3');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(createInvite).toHaveBeenCalledWith({ maxUses: 5, expiresInDays: 3 });
    expect(wrapper.find('[data-test="invite-link"]').text()).toContain(
      `${window.location.origin}/invite/abc123`,
    );
    expect(listInvites).toHaveBeenCalledTimes(2);
  });

  it('defaults to one use and seven days', async () => {
    const createInvite = vi.fn().mockResolvedValue({ invite: valid, code: 'c' });
    const { wrapper } = await mountWithApi(InvitationsPanel, {
      admin: { listInvites: vi.fn().mockResolvedValue([]), createInvite },
    });
    await flushPromises();
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(createInvite).toHaveBeenCalledWith({ maxUses: 1, expiresInDays: 7 });
  });

  it('shares with the Web Share API when the browser has it', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } });
    const { wrapper } = await mountWithApi(InvitationsPanel, {
      admin: {
        listInvites: vi.fn().mockResolvedValue([]),
        createInvite: vi.fn().mockResolvedValue({ invite: valid, code: 'xyz' }),
      },
    });
    await flushPromises();
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    await wrapper.find('button[name="share"]').trigger('click');
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: `${window.location.origin}/invite/xyz` }),
    );
  });

  it('falls back to copying when the browser cannot share', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { wrapper } = await mountWithApi(InvitationsPanel, {
      admin: {
        listInvites: vi.fn().mockResolvedValue([]),
        createInvite: vi.fn().mockResolvedValue({ invite: valid, code: 'xyz' }),
      },
    });
    await flushPromises();
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('button[name="share"]').exists()).toBe(false);
    await wrapper.find('button[name="copy"]').trigger('click');
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/xyz`);
    expect(wrapper.find('[data-test="invite-link"]').text()).toContain('Copied.');
  });

  it('revokes after confirming', async () => {
    const revokeInvite = vi.fn().mockResolvedValue(undefined);
    const listInvites = vi.fn().mockResolvedValue([valid]);
    window.confirm = vi.fn().mockReturnValue(true);
    const { wrapper } = await mountWithApi(InvitationsPanel, {
      admin: { listInvites, revokeInvite },
    });
    await flushPromises();
    await wrapper.find('[data-test="invite"] button').trigger('click');
    await flushPromises();
    expect(revokeInvite).toHaveBeenCalledWith(1);
    expect(listInvites).toHaveBeenCalledTimes(2);
  });

  it('does not revoke when the confirmation is declined', async () => {
    const revokeInvite = vi.fn();
    window.confirm = vi.fn().mockReturnValue(false);
    const { wrapper } = await mountWithApi(InvitationsPanel, {
      admin: { listInvites: vi.fn().mockResolvedValue([valid]), revokeInvite },
    });
    await flushPromises();
    await wrapper.find('[data-test="invite"] button').trigger('click');
    expect(revokeInvite).not.toHaveBeenCalled();
  });
});
