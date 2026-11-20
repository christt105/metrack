import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ntfySubscriptionUrl } from '@metrack/domain';
import NtfyAlertsPanel from '../src/components/NtfyAlertsPanel.vue';
import { mountWithApi } from './mountWithApi';

describe('NtfyAlertsPanel', () => {
  it('explains what ntfy is and that the link opens on the phone', async () => {
    const { wrapper } = await mountWithApi(NtfyAlertsPanel, {}, { topic: null });
    expect(wrapper.text()).toContain('ntfy is a free app');
    expect(wrapper.text()).toContain('open the link below on that phone');
  });

  it('copies the subscription link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { wrapper } = await mountWithApi(NtfyAlertsPanel, {}, { topic: 'secret-topic' });
    await wrapper.find('[data-test="ntfy-copy"]').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(ntfySubscriptionUrl('secret-topic'));
    expect(wrapper.find('[data-test="ntfy-copy"]').text()).toBe('Copied.');
  });
});
