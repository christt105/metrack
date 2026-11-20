import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { enableAutoUnmount } from '@vue/test-utils';
import { createMemoryHistory } from 'vue-router';
import type { PublicPage, User } from '@metrack/domain';
import type { ApiClient } from '../src/api/ApiClient';
import { apiKey } from '../src/api/apiKey';
import App from '../src/App.vue';
import { Session } from '../src/auth/Session';
import { sessionKey } from '../src/auth/sessionKey';
import { createAppRouter } from '../src/router/createAppRouter';

enableAutoUnmount(afterEach);

const USER: User = { id: 2, name: 'Friend', email: null, role: 'normal' };
const page = (patch: Partial<PublicPage>): PublicPage => ({
  handle: 'friend',
  enabled: true,
  avatar: null,
  intro: null,
  description: null,
  about: null,
  giscus: null,
  ...patch,
});

async function mountApp(publicPage: PublicPage) {
  const api = {
    me: async () => USER,
    accountStatus: async () => ({ deletion: null, needsWelcome: false }),
    ownSettings: async () => ({ publicPage, settings: { language: null } }),
  } as unknown as ApiClient;
  const session = new Session(api);
  await session.current();
  const router = createAppRouter(createMemoryHistory());
  await router.push('/settings');
  await router.isReady();
  const wrapper = mount(App, {
    global: {
      plugins: [router],
      provide: { [apiKey as symbol]: api, [sessionKey as symbol]: session },
      stubs: { RouterView: true, DeletionBanner: true, OfflineNotice: true },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('top bar public page link', () => {
  it('opens the own public page in a new tab when it is on', async () => {
    const link = (await mountApp(page({}))).get('a[href="/u/friend/"]');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener');
    expect(link.attributes('aria-label')).toBe('Open your public page');
  });

  it('is hidden while the page is off or has no handle', async () => {
    expect((await mountApp(page({ enabled: false }))).find('a[href^="/u/"]').exists()).toBe(false);
    expect((await mountApp(page({ handle: null }))).find('a[href^="/u/"]').exists()).toBe(false);
  });
});
