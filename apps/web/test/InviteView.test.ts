import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import InviteView from '../src/views/InviteView.vue';
import { mountWithApi } from './mountWithApi';

async function open(status: string) {
  const invitePreview = vi.fn().mockResolvedValue({ status, inviter: 'Christian' });
  const { wrapper } = await mountWithApi(InviteView, { invitePreview }, { code: 'abc-123' });
  await flushPromises();
  return { wrapper, invitePreview };
}

describe('InviteView', () => {
  it('names who invites and offers Sign in with Google carrying the code', async () => {
    const { wrapper, invitePreview } = await open('valid');
    expect(invitePreview).toHaveBeenCalledWith('abc-123');
    expect(wrapper.text()).toContain('Christian invites you to metrack');
    const button = wrapper.find('a.google');
    expect(button.text()).toBe('Sign in with Google');
    expect(button.attributes('href')).toBe('/api/auth/google/start?invite=abc-123');
  });

  it.each([
    ['expired', 'expired'],
    ['revoked', 'cancelled'],
    ['used_up', 'already been used'],
    ['unknown', 'not valid'],
  ])('shows a clear message and no sign-in for a %s link', async (status, text) => {
    const { wrapper } = await open(status);
    expect(wrapper.find('a.google').exists()).toBe(false);
    expect(wrapper.find('[data-test="invite-problem"]').text()).toContain(text);
  });
});
