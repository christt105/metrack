import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { ApiToken } from '@metrack/domain';
import TokensPanel from '../src/components/TokensPanel.vue';
import { mountWithApi } from './mountWithApi';

const connector: ApiToken = {
  id: 1,
  name: 'Connector',
  scope: 'write',
  createdAt: '2026-11-07T12:00:00.000Z',
  expiresAt: null,
  lastUsedAt: '2026-11-08T09:30:00.000Z',
};

describe('TokensPanel', () => {
  it('lists tokens with their access, dates and last use', async () => {
    const { wrapper } = await mountWithApi(TokensPanel, {
      listTokens: vi.fn().mockResolvedValue([connector]),
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Connector');
    expect(wrapper.text()).toContain(
      'Read and write · created 2026-11-07 · never expires · last used 2026-11-08',
    );
  });

  it('creates a token, shows its secret once and reloads the list', async () => {
    const listTokens = vi.fn().mockResolvedValueOnce([]).mockResolvedValue([connector]);
    const createToken = vi.fn().mockResolvedValue({ token: connector, secret: 'mt_secret' });
    const { wrapper } = await mountWithApi(TokensPanel, { listTokens, createToken });
    await flushPromises();
    expect(wrapper.text()).toContain('No tokens yet.');

    await wrapper.find('input[name="name"]').setValue('Connector');
    await wrapper.find('select[name="scope"]').setValue('write');
    const lifetimes = wrapper.find('select[name="expiresInDays"]').findAll('option');
    expect(lifetimes.map((option) => option.text())).toEqual([
      'In 30 days',
      'In 90 days',
      'In 365 days',
      'Never',
    ]);
    await lifetimes[3]?.setValue();
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(createToken).toHaveBeenCalledWith({
      name: 'Connector',
      scope: 'write',
      expiresInDays: null,
    });
    expect(wrapper.find('code').text()).toBe('mt_secret');
    expect(wrapper.text()).toContain('it is not shown again');
    expect(listTokens).toHaveBeenCalledTimes(2);
    expect((wrapper.find('input[name="name"]').element as HTMLInputElement).value).toBe('');
  });

  it('revokes a token after confirming', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    const listTokens = vi.fn().mockResolvedValueOnce([connector]).mockResolvedValue([]);
    const revokeToken = vi.fn().mockResolvedValue(undefined);
    const { wrapper } = await mountWithApi(TokensPanel, { listTokens, revokeToken });
    await flushPromises();
    await wrapper.find('.tokens button').trigger('click');
    await flushPromises();
    expect(revokeToken).toHaveBeenCalledWith(1);
    expect(wrapper.text()).toContain('No tokens yet.');
  });
});
