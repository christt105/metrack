import { fakeApi } from './fakeApi';
import type { ApiOverrides } from './ApiOverrides';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import type { HealthReport, User } from '@metrack/domain';
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
  const session = new Session(
    fakeApi({
      auth: { me },
    }),
  );
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
    await expect(client.following.listWatchlist()).rejects.toBeInstanceOf(ApiRequestError);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(await client.auth.me()).toBeNull();
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('answers null from devUsers() when the server has no dev login', async () => {
    const client = new ApiClient(
      (async () =>
        new Response('{"error":"Not found","code":"not_found"}', {
          status: 404,
        })) as unknown as typeof fetch,
    );
    expect(await client.auth.devUsers()).toBeNull();
  });
});

describe('LoginView', () => {
  async function mountLogin(api: ApiOverrides, next?: string) {
    const session = new Session(fakeApi(api));
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
      {
        auth: { devUsers: async () => [OWNER, FRIEND], devLogin },
      },
      '/watchlist',
    );
    const buttons = wrapper.findAll('button');
    expect(buttons.map((b) => b.text())).toEqual(['Owner', 'Friend friend@example.com', 'Sign in']);
    await buttons[1]?.trigger('click');
    await flushPromises();
    expect(devLogin).toHaveBeenCalledWith(2);
    expect(session.user.value).toEqual(FRIEND);
    expect(router.currentRoute.value.fullPath).toBe('/watchlist');
  });

  it('says sign-in is with a Google account and that Jellyfin is optional', async () => {
    const { wrapper } = await mountLogin({
      auth: { devUsers: async () => null },
    });
    expect(wrapper.find('[data-test="google-note"]').text()).toContain('Google account');
    expect(wrapper.text()).toContain('if you use Jellyfin');
  });

  it('offers only the token form when dev login is off', async () => {
    const { wrapper } = await mountLogin({
      auth: { devUsers: async () => null },
    });
    expect(wrapper.text()).toContain('Sign in with an access token');
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['Sign in']);
  });

  it('offers the Google link only when the server has it, and explains a refusal', async () => {
    const health = (googleLogin: boolean) => async () =>
      ({ features: { backups: false, sync: false, googleLogin } }) as HealthReport;
    const off = await mountLogin({
      auth: { devUsers: async () => null, health: health(false) },
    });
    expect(off.wrapper.find('a.google').exists()).toBe(false);
    const on = await mountLogin({
      auth: { devUsers: async () => null, health: health(true) },
    });
    expect(on.wrapper.find('a.google').attributes('href')).toBe('/api/auth/google/start');
    await on.router.push({ name: 'login', query: { error: 'google_no_account' } });
    await flushPromises();
    expect(on.wrapper.text()).toContain('There is no metrack account for that Google account');
    await on.router.push({ name: 'login', query: { error: 'google_failed' } });
    await flushPromises();
    expect(on.wrapper.text()).toContain('Signing in with Google did not work');
  });

  it('signs in with an access token and goes on to the next page', async () => {
    const tokenLogin = vi.fn(async () => FRIEND);
    const { wrapper, router, session } = await mountLogin(
      {
        auth: { devUsers: async () => null, tokenLogin },
      },
      '/watchlist',
    );
    await wrapper.find('input').setValue('  mt_secret ');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(tokenLogin).toHaveBeenCalledWith('mt_secret');
    expect(session.user.value).toEqual(FRIEND);
    expect(router.currentRoute.value.fullPath).toBe('/watchlist');
  });

  it('shows the error of a refused token', async () => {
    const tokenLogin = vi.fn(async () => {
      throw new Error('Unknown or expired token');
    });
    const { wrapper } = await mountLogin({
      auth: { devUsers: async () => null, tokenLogin },
    });
    await wrapper.find('input').setValue('mt_bad');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Unknown or expired token');
  });
});

describe('sessions and a waiting deletion', () => {
  const scheduled = {
    requestedAt: '2026-11-08T10:00:00.000Z',
    deleteAt: '2026-11-15T10:00:00.000Z',
  };

  it('learns about a waiting deletion on sign-in and forgets it on sign-out', async () => {
    const accountStatus = vi.fn(async () => ({
      deletion: scheduled,
      canDelete: true,
      needsWelcome: false,
    }));
    const session = new Session(
      fakeApi({
        auth: { me: async () => FRIEND, logout: async () => {} },
        account: { accountStatus },
      }),
    );
    expect(await session.current()).toEqual(FRIEND);
    expect(session.deletion.value).toEqual(scheduled);
    await session.signOut();
    expect(session.deletion.value).toBeNull();
  });

  it('carries on when the account status cannot be read', async () => {
    const session = new Session(
      fakeApi({
        auth: { me: async () => FRIEND },
        account: {
          accountStatus: async () => {
            throw new ApiRequestError('down', 0, 'network_error');
          },
        },
      }),
    );
    expect(await session.current()).toEqual(FRIEND);
    expect(session.deletion.value).toBeNull();
  });
});

describe('first entry guard', () => {
  function welcomeRouter(needsWelcome: boolean) {
    const session = new Session(
      fakeApi({
        auth: { me: async () => FRIEND },
        account: { accountStatus: async () => ({ deletion: null, canDelete: true, needsWelcome }) },
      }),
    );
    const router = createAppRouter(createMemoryHistory());
    installAuthGuard(router, session);
    return { router, session };
  }

  it('keeps a user who has not confirmed on the first-entry form', async () => {
    const { router, session } = welcomeRouter(true);
    await router.push('/settings');
    expect(router.currentRoute.value.name).toBe('welcome');
    expect(session.needsWelcome.value).toBe(true);
    await router.push('/search');
    expect(router.currentRoute.value.name).toBe('welcome');
  });

  it('lets them in once they have confirmed', async () => {
    const { router, session } = welcomeRouter(true);
    await router.push('/');
    session.welcomed({ ...FRIEND, name: 'Ana' });
    await router.push('/search');
    expect(router.currentRoute.value.name).toBe('search');
  });

  it('keeps users who are already set up away from the form', async () => {
    const { router } = welcomeRouter(false);
    await router.push('/welcome');
    expect(router.currentRoute.value.name).toBe('library');
  });

  it('opens the invitation page with no session', async () => {
    const session = new Session(
      fakeApi({
        auth: { me: async () => null },
      }),
    );
    const router = createAppRouter(createMemoryHistory());
    installAuthGuard(router, session);
    await router.push('/invite/abc');
    expect(router.currentRoute.value.name).toBe('invite');
    expect(router.currentRoute.value.params.code).toBe('abc');
  });
});
