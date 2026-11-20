import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ntfyAppUrl, ntfySubscriptionUrl } from '@metrack/domain';
import NtfyAlertsPanel from '../src/components/NtfyAlertsPanel.vue';
import { mountWithApi } from './mountWithApi';

describe('NtfyAlertsPanel', () => {
  it('explains what ntfy is without a subscribe-on-open claim', async () => {
    const { wrapper } = await mountWithApi(NtfyAlertsPanel, {}, { topic: null });
    expect(wrapper.text()).toContain('ntfy is a free app');
    expect(wrapper.text()).not.toContain('subscribes you');
  });

  it('offers the Android deep link, the topic name and the browser link', async () => {
    const { wrapper } = await mountWithApi(NtfyAlertsPanel, {}, { topic: 'secret-topic' });
    expect(wrapper.find('[data-test="ntfy-app-link"]').attributes('href')).toBe(
      ntfyAppUrl('secret-topic'),
    );
    expect(wrapper.find('[data-test="ntfy-topic"]').text()).toBe('secret-topic');
    expect(wrapper.find('[data-test="ntfy-link"]').attributes('href')).toBe(
      ntfySubscriptionUrl('secret-topic'),
    );
    expect(wrapper.text()).toContain('iPhone');
  });

  it('copies the topic name', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { wrapper } = await mountWithApi(NtfyAlertsPanel, {}, { topic: 'secret-topic' });
    await wrapper.find('[data-test="ntfy-copy"]').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith('secret-topic');
    expect(wrapper.find('[data-test="ntfy-copy"]').text()).toBe('Copied.');
  });

  it('shows a message when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const { wrapper } = await mountWithApi(NtfyAlertsPanel, {}, { topic: 'secret-topic' });
    await wrapper.find('[data-test="ntfy-copy"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="ntfy-copy-failed"]').exists()).toBe(true);
  });
});
