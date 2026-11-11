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
  it('builds the export in the browser and saves it', async () => {
    const accountExportData = vi.fn().mockResolvedValue({
      exportedAt: '2026-03-05T12:00:00.000Z',
      user: { id: 3 },
      images: [
        { hash: 'a', file: 'images/a.webp' },
        { hash: 'b', file: 'images/b.webp' },
      ],
    });
    const imageBytes = vi.fn(async (hash: string) => {
      if (hash === 'b') throw new Error('gone');
      return new Uint8Array([1, 2, 3]);
    });
    const createObjectURL = vi.fn(() => 'blob:export');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const clicked: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this.download);
    });
    const { wrapper } = await mountWithApi(
      AccountPanel,
      {
        accountStatus: vi.fn().mockResolvedValue({ deletion: null, canDelete: true }),
        accountExportData,
        imageBytes,
      },
      { handle: null },
    );
    await flushPromises();

    await wrapper.find('[data-test="export"]').trigger('click');
    await vi.waitFor(() => expect(wrapper.find('[data-test="export-done"]').exists()).toBe(true));

    expect(clicked).toEqual(['metrack-export-user-3-2026-03-05.zip']);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-test="export-missing"]').text()).toContain('1 image could not');
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('shows the error when the data cannot be fetched', async () => {
    const { wrapper } = await mountWithApi(
      AccountPanel,
      {
        accountStatus: vi.fn().mockResolvedValue({ deletion: null, canDelete: true }),
        accountExportData: vi.fn().mockRejectedValue(new ApiRequestError('Boom', 500, '')),
      },
      { handle: null },
    );
    await flushPromises();
    await wrapper.find('[data-test="export"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Boom');
    expect(wrapper.find('[data-test="export"]').attributes('disabled')).toBeUndefined();
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
    await wrapper.find('button:not([data-test="export"])').trigger('click');
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
