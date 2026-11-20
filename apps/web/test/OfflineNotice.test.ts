import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ApiClient } from '../src/api/ApiClient';
import OfflineNotice from '../src/components/OfflineNotice.vue';
import { Connectivity } from '../src/connectivity/Connectivity';
import { connectivityKey } from '../src/connectivity/connectivityKey';
import { en as messages } from '../src/i18n/messages/en';

function setup(online: boolean) {
  const target = new EventTarget();
  const connectivity = new Connectivity(target as unknown as Window, online);
  const wrapper = mount(OfflineNotice, {
    global: { provide: { [connectivityKey as symbol]: connectivity } },
  });
  return { target, connectivity, wrapper };
}

describe('OfflineNotice', () => {
  it('is hidden while online and shown when the browser goes offline', async () => {
    const { target, wrapper } = setup(true);
    expect(wrapper.text()).toBe('');
    target.dispatchEvent(new Event('offline'));
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe(messages.offline);
    target.dispatchEvent(new Event('online'));
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('');
  });

  it('is shown from the start when the browser begins offline', () => {
    expect(setup(false).wrapper.text()).toBe(messages.offline);
  });

  it('appears when an API call fails for lack of network and clears on the next success', async () => {
    const { connectivity, wrapper } = setup(true);
    let fail = true;
    const client = new ApiClient(
      (async () => {
        if (fail) throw new TypeError('Failed to fetch');
        return new Response('{}');
      }) as typeof fetch,
      undefined,
      undefined,
      (reachable) => connectivity.report(reachable),
    );
    await expect(client.me()).rejects.toThrow();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe(messages.offline);
    fail = false;
    await client.me().catch(() => undefined);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('');
  });
});
