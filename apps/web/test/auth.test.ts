import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import type { User } from '@metrack/domain';
import { ApiClient } from '../src/api/ApiClient';
import { ApiRequestError } from '../src/api/ApiRequestError';
import { Session } from '../src/auth/Session';
import { sessionKey } from '../src/auth/sessionKey';
import { createAppRouter } from '../src/router/createAppRouter';
import { installAuthGuard } from '../src/router/installAuthGuard';
import LoginView from '../src/views/LoginView.vue';
import { mountWithApi } from './mountWithApi';

const OWNER: User = { id: 1, name: 'Owner', email: null, role: 'owner' };
const FRIEND: User = { id: 2, name: 'Friend', email: 'friend@example.com', role: 'normal' };

function guardedRouter(me: () => Promise<User | null>) {
  const session = new Session({ me } as unknown as ApiClient);
  const router = createAppRouter(createMemoryHistory());
  installAuthGuard(router, session);
  return { router, session };
}

describe('auth guard', () => {
  it('sends a visitor with no session to the sign-in page, keeping where they were going', async () => {
    const { router } = guardedRouter(async () => null);
    await router.push('/movies/3');
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query).toEqual({ next: '/movies/3' });
  });

  it('lets a signed-in user through and asks the server only once', async () => {
    const me = vi.fn(async () => OWNER);
    const { router } = guardedRouter(me);
    await router.push('/movies/3');
    await router.push('/settings');
    expect(router.currentRoute.value.name).toBe('settings');
    expect(me).toHaveBeenCalledTimes(1);
  });

  it('opens the page when the server cannot be reached', async () => {
    const { router } = guardedRouter(async () => {
      throw new ApiRequestError('down', 0, 'network_error');
    });
    await router.push('/settings');
    expect(router.currentRoute.value.name).toBe('settings');
  });
});

describe('ApiClient and sessions', () => {
  const refused = () =>
    new Response(JSON.stringify({ error: 'Sign in first', code: 'unauthenticated' }), {
      status: 401,
    });

  it('reports a refused call outside /auth, and answers null from me()', async () => {
    const onUnauthenticated = vi.fn();
    const client = new ApiClient(
      (async () => refused()) as unknown as typeof fetch,
      onUnauthenticated,
    );
    await expect(client.listWatchlist()).rejects.toBeInstanceOf(ApiRequestError);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(await client.me()).toBeNull();
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('answers null from devUsers() when the server has no dev login', async () => {
    const client = new ApiClient(
      (async () =>
        new Response('{"error":"Not found","code":"not_found"}', {
          status: 404,
        })) as unknown as typeof fetch,
    );
    expect(await client.devUsers()).toBeNull();
  });
});

describe('LoginView', () => {
  async function mountLogin(api: Partial<ApiClient>, next?: string) {
    const session = new Session(api as ApiClient);
    const { wrapper, router } = await mountWithApi(
      LoginView,
      api,
      {},
      { [sessionKey as symbol]: session },
    );
    if (next) await router.push({ name: 'login', query: { next } });
    await flushPromises();
    return { wrapper, router, session };
  }

  it('lists the users and signs in as the one picked', async () => {
    const devLogin = vi.fn(async () => FRIEND);
    const { wrapper, router, session } = await mountLogin(
      { devUsers: async () => [OWNER, FRIEND], devLogin },
      '/watchlist',
    );
    const buttons = wrapper.findAll('button');
    expect(buttons.map((b) => b.text())).toEqual(['Owner', 'Friend friend@example.com']);
    await buttons[1]?.trigger('click');
    await flushPromises();
    expect(devLogin).toHaveBeenCalledWith(2);
    expect(session.user.value).toEqual(FRIEND);
    expect(router.currentRoute.value.fullPath).toBe('/watchlist');
  });

  it('says there is no way to sign in when dev login is off', async () => {
    const { wrapper } = await mountLogin({ devUsers: async () => null });
    expect(wrapper.text()).toContain('no way to sign in');
    expect(wrapper.findAll('button')).toHaveLength(0);
  });
});

describe('sessions and a waiting deletion', () => {
  const scheduled = {
    requestedAt: '2026-11-08T10:00:00.000Z',
    deleteAt: '2026-11-15T10:00:00.000Z',
  };

  it('learns about a waiting deletion on sign-in and forgets it on sign-out', async () => {
    const accountStatus = vi.fn(async () => ({ deletion: scheduled, canDelete: true }));
    const session = new Session({
      me: async () => FRIEND,
      accountStatus,
      logout: async () => {},
    } as unknown as ApiClient);
    expect(await session.current()).toEqual(FRIEND);
    expect(session.deletion.value).toEqual(scheduled);
    await session.signOut();
    expect(session.deletion.value).toBeNull();
  });

  it('carries on when the account status cannot be read', async () => {
    const session = new Session({
      me: async () => FRIEND,
      accountStatus: async () => {
        throw new ApiRequestError('down', 0, 'network_error');
      },
    } as unknown as ApiClient);
    expect(await session.current()).toEqual(FRIEND);
    expect(session.deletion.value).toBeNull();
  });
});
