import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { AccountDeletion } from '@metrack/domain';
import { ApiRequestError } from '../src/api/ApiRequestError';
import { Session } from '../src/auth/Session';
import { sessionKey } from '../src/auth/sessionKey';
import AccountPanel from '../src/components/AccountPanel.vue';
import DeletionBanner from '../src/components/DeletionBanner.vue';
import type { ApiClient } from '../src/api/ApiClient';
import { mountWithApi } from './mountWithApi';

const scheduled: AccountDeletion = {
  requestedAt: '2026-11-08T10:00:00.000Z',
  deleteAt: '2026-11-15T10:00:00.000Z',
};

describe('AccountPanel', () => {
  it('offers the export as a download link', async () => {
    const { wrapper } = await mountWithApi(
      AccountPanel,
      { accountStatus: vi.fn().mockResolvedValue({ deletion: null, canDelete: true }) },
      { handle: null },
    );
    await flushPromises();
    const link = wrapper.find('[data-test="export"]');
    expect(link.attributes('href')).toBe('/api/account/export');
    expect(link.attributes('download')).toBeDefined();
  });

  it('asks for the typed confirmation and schedules the deletion', async () => {
    const accountStatus = vi
      .fn()
      .mockResolvedValueOnce({ deletion: null, canDelete: true })
      .mockResolvedValue({ deletion: scheduled, canDelete: true });
    const requestAccountDeletion = vi.fn().mockResolvedValue(scheduled);
    const { wrapper } = await mountWithApi(
      AccountPanel,
      { accountStatus, requestAccountDeletion },
      { handle: 'nia' },
    );
    await flushPromises();
    expect(wrapper.text()).toContain('Type your handle (nia) or "delete"');
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined();

    await wrapper.find('input[name="confirm"]').setValue('delete');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(requestAccountDeletion).toHaveBeenCalledWith('delete');
    expect(wrapper.text()).toContain('scheduled for deletion on 2026-11-15');
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('cancels a waiting deletion', async () => {
    const accountStatus = vi
      .fn()
      .mockResolvedValueOnce({ deletion: scheduled, canDelete: true })
      .mockResolvedValue({ deletion: null, canDelete: true });
    const cancelAccountDeletion = vi.fn().mockResolvedValue({ deletion: null, canDelete: true });
    const { wrapper } = await mountWithApi(
      AccountPanel,
      { accountStatus, cancelAccountDeletion },
      { handle: null },
    );
    await flushPromises();
    expect(wrapper.text()).toContain('scheduled for deletion on 2026-11-15');
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(cancelAccountDeletion).toHaveBeenCalled();
    expect(wrapper.find('form').exists()).toBe(true);
  });

  it('shows the server refusal for a wrong confirmation', async () => {
    const requestAccountDeletion = vi
      .fn()
      .mockRejectedValue(new ApiRequestError('no', 400, 'confirmation_mismatch'));
    const { wrapper } = await mountWithApi(
      AccountPanel,
      {
        accountStatus: vi.fn().mockResolvedValue({ deletion: null, canDelete: true }),
        requestAccountDeletion,
      },
      { handle: null },
    );
    await flushPromises();
    await wrapper.find('input[name="confirm"]').setValue('x');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toContain('does not match');
  });

  it('tells the owner their account cannot be deleted and offers no way to', async () => {
    const { wrapper } = await mountWithApi(
      AccountPanel,
      { accountStatus: vi.fn().mockResolvedValue({ deletion: null, canDelete: false }) },
      { handle: null },
    );
    await flushPromises();
    expect(wrapper.text()).toContain('The owner account cannot be deleted.');
    expect(wrapper.find('form').exists()).toBe(false);
  });
});

describe('DeletionBanner', () => {
  it('shows only while a deletion waits, and cancels it', async () => {
    const cancelAccountDeletion = vi.fn().mockResolvedValue({ deletion: null, canDelete: true });
    const api = { cancelAccountDeletion } as unknown as ApiClient;
    const session = new Session(api);
    session.setDeletion(scheduled);
    const { wrapper } = await mountWithApi(
      DeletionBanner,
      api,
      {},
      { [sessionKey as symbol]: session },
    );
    expect(wrapper.text()).toContain('Your account will be deleted on 2026-11-15');
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(cancelAccountDeletion).toHaveBeenCalled();
    expect(wrapper.text()).toBe('');
  });
});
