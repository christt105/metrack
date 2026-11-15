import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserSummary } from '@metrack/domain';
import UsersPanel from '../src/components/UsersPanel.vue';
import { mountWithApi } from './mountWithApi';

const owner: UserSummary = {
  id: 1,
  name: 'Christian',
  email: null,
  role: 'owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  usedBytes: 0,
  deletion: null,
};
const friend: UserSummary = {
  id: 2,
  name: 'Ana',
  email: 'ana@example.com',
  role: 'normal',
  createdAt: '2026-11-16T10:00:00.000Z',
  usedBytes: 3 * 1024 * 1024,
  deletion: null,
};

afterEach(() => vi.restoreAllMocks());

describe('UsersPanel', () => {
  it('shows name, email, sign-up date and storage, with no delete button for the owner', async () => {
    const { wrapper } = await mountWithApi(UsersPanel, {
      listUserSummaries: vi.fn().mockResolvedValue([owner, friend]),
    });
    await flushPromises();
    const rows = wrapper.findAll('[data-test="account"]');
    expect(rows[1]?.text()).toContain('Ana');
    expect(rows[1]?.text()).toContain('ana@example.com');
    expect(rows[1]?.text()).toContain('Joined 2026-11-16');
    expect(rows[1]?.text()).toContain('3.0 MB');
    expect(rows[0]?.find('button').exists()).toBe(false);
    expect(rows[1]?.find('button').exists()).toBe(true);
  });

  it('schedules a deletion after confirming and reloads', async () => {
    const scheduleUserDeletion = vi.fn().mockResolvedValue({});
    const listUserSummaries = vi.fn().mockResolvedValue([owner, friend]);
    window.confirm = vi.fn().mockReturnValue(true);
    const { wrapper } = await mountWithApi(UsersPanel, { listUserSummaries, scheduleUserDeletion });
    await flushPromises();
    await wrapper.findAll('[data-test="account"]')[1]!.find('button').trigger('click');
    await flushPromises();
    expect(scheduleUserDeletion).toHaveBeenCalledWith(2);
    expect(listUserSummaries).toHaveBeenCalledTimes(2);
  });

  it('shows a waiting deletion and lets the owner cancel it', async () => {
    const cancelUserDeletion = vi.fn().mockResolvedValue(undefined);
    const waiting: UserSummary = {
      ...friend,
      deletion: { requestedAt: '2026-11-20T00:00:00.000Z', deleteAt: '2026-11-27T00:00:00.000Z' },
    };
    const { wrapper } = await mountWithApi(UsersPanel, {
      listUserSummaries: vi.fn().mockResolvedValue([owner, waiting]),
      cancelUserDeletion,
    });
    await flushPromises();
    const row = wrapper.findAll('[data-test="account"]')[1]!;
    expect(row.text()).toContain('deletion on 2026-11-27');
    await row.find('button').trigger('click');
    expect(cancelUserDeletion).toHaveBeenCalledWith(2);
  });
});
