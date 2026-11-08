import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { createMemoryHistory } from 'vue-router';
import type { ApiClient } from '../src/api/ApiClient';
import { apiKey } from '../src/api/apiKey';
import { Session } from '../src/auth/Session';
import { sessionKey } from '../src/auth/sessionKey';
import { createAppRouter } from '../src/router/createAppRouter';

/** Mounts a component with a fake API client, a session over it and an in-memory router. */
export async function mountWithApi(
  component: Component,
  api: Partial<ApiClient>,
  props: Record<string, unknown> = {},
  provide: Record<symbol, unknown> = {},
) {
  const router = createAppRouter(createMemoryHistory());
  await router.push('/');
  await router.isReady();
  const wrapper = mount(component, {
    props,
    global: {
      plugins: [router],
      provide: {
        [apiKey as symbol]: api,
        [sessionKey as symbol]: new Session(api as ApiClient),
        ...provide,
      },
    },
  });
  return { wrapper, router };
}
