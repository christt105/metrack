import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { createMemoryHistory } from 'vue-router';
import type { ApiOverrides } from './ApiOverrides';
import { fakeApi } from './fakeApi';
import { apiKey } from '../src/api/apiKey';
import { Session } from '../src/auth/Session';
import { LibraryCache } from '../src/library/LibraryCache';
import { libraryCacheKey } from '../src/library/libraryCacheKey';
import { sessionKey } from '../src/auth/sessionKey';
import { createAppRouter } from '../src/router/createAppRouter';

/** Mounts a component with a fake API client, a session over it and an in-memory router. */
export async function mountWithApi(
  component: Component,
  overrides: ApiOverrides,
  props: Record<string, unknown> = {},
  provide: Record<symbol, unknown> = {},
) {
  const api = fakeApi(overrides);
  const router = createAppRouter(createMemoryHistory());
  await router.push('/');
  await router.isReady();
  const wrapper = mount(component, {
    attachTo: document.body,
    props,
    global: {
      plugins: [router],
      provide: {
        [apiKey as symbol]: api,
        [sessionKey as symbol]: new Session(api),
        [libraryCacheKey as symbol]: new LibraryCache(),
        ...provide,
      },
    },
  });
  return { wrapper, router };
}
