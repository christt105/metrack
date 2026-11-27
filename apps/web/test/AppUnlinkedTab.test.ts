import { fakeApi } from './fakeApi';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { enableAutoUnmount } from '@vue/test-utils';
import { createMemoryHistory } from 'vue-router';
import type { User } from '@metrack/domain';
import { apiKey } from '../src/api/apiKey';
import App from '../src/App.vue';
import { Session } from '../src/auth/Session';
import { sessionKey } from '../src/auth/sessionKey';
import { createAppRouter } from '../src/router/createAppRouter';
import { EMPTY_PAGE } from './EMPTY_PAGE';

enableAutoUnmount(afterEach);

const USER: User = { id: 2, name: 'Friend', email: null, role: 'normal' };

async function mountApp(jellyfinUser: string | null) {
  const api = fakeApi({
    auth: { me: async () => USER },
    accountStatus: async () => ({ deletion: null, needsWelcome: false, canDelete: true }),
    ownSettings: async () => ({
      publicPage: EMPTY_PAGE,
      settings: {
        language: null,
        jellyfinUser,
        ntfyTopic: null,
        steamId: null,
        mirrorDir: null,
        mirrorLinkPrefix: null,
      },
      owner: false,
      ntfyTopicGenerated: false,
    }),
    listUnlinked: async () => [],
  });
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
  return { wrapper, router };
}

describe('unlinked tab', () => {
  it('is shown to a user with a Jellyfin account', async () => {
    const { wrapper } = await mountApp('friend');
    expect(wrapper.findAll('a[href="/unlinked"]')).toHaveLength(2);
  });

  it('is hidden from a user without one, while the route still resolves', async () => {
    const { wrapper, router } = await mountApp(null);
    expect(wrapper.find('a[href="/unlinked"]').exists()).toBe(false);
    expect(router.resolve('/unlinked').name).toBe('unlinked');
  });
});
