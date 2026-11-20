import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@metrack/domain';
import { ApiRequestError } from '../src/api/ApiRequestError';
import { Session } from '../src/auth/Session';
import { sessionKey } from '../src/auth/sessionKey';
import { Locale } from '../src/i18n/Locale';
import { localeKey } from '../src/i18n/localeKey';
import WelcomeView from '../src/views/WelcomeView.vue';
import { mountWithApi } from './mountWithApi';
import type { ApiClient } from '../src/api/ApiClient';

const joined: User = { id: 5, name: 'Ana García', email: 'ana@example.com', role: 'normal' };

async function open(api: Partial<ApiClient>) {
  const session = new Session(api as ApiClient);
  session.signedIn(joined);
  session.needsWelcome.value = true;
  const mounted = await mountWithApi(WelcomeView, api, {}, { [sessionKey as symbol]: session });
  return { ...mounted, session };
}

describe('WelcomeView', () => {
  it('prefills the name from Google and a handle derived from it', async () => {
    const { wrapper } = await open({});
    expect((wrapper.find('input[name="name"]').element as HTMLInputElement).value).toBe(
      'Ana García',
    );
    expect((wrapper.find('input[name="handle"]').element as HTMLInputElement).value).toBe(
      'ana-garcia',
    );
  });

  it('confirms the name and handle, clears the welcome state and leaves for the library', async () => {
    const completeWelcome = vi.fn().mockResolvedValue({ ...joined, name: 'Ana' });
    const { wrapper, session, router } = await open({ completeWelcome });
    await wrapper.find('input[name="name"]').setValue(' Ana ');
    await wrapper.find('input[name="handle"]').setValue('ana');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(completeWelcome).toHaveBeenCalledWith({ name: 'Ana', handle: 'ana' });
    expect(session.needsWelcome.value).toBe(false);
    expect(session.user.value?.name).toBe('Ana');
    expect(router.currentRoute.value.name).toBe('library');
  });

  it('explains an invalid handle with the shared rules and blocks sending it', async () => {
    const completeWelcome = vi.fn();
    const { wrapper } = await open({ completeWelcome });
    await wrapper.find('input[name="handle"]').setValue('No Good!');
    expect(wrapper.find('[data-test="handle-problem"]').text()).toContain('lowercase letters');
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined();
    await wrapper.find('input[name="handle"]').setValue('ab');
    expect(wrapper.find('[data-test="handle-problem"]').text()).toContain('3 to 30');
    expect(completeWelcome).not.toHaveBeenCalled();
  });

  it('shows the full public address and says the page starts turned off', async () => {
    const { wrapper } = await open({});
    expect(wrapper.text()).toContain(`${window.location.origin}/u/ana-garcia/`);
    expect(wrapper.text()).toContain('starts turned off');
  });

  it('translates the handle problems into Spanish', async () => {
    const { wrapper } = await open({}).then(async () => {
      const api: Partial<ApiClient> = {};
      const session = new Session(api as ApiClient);
      session.signedIn(joined);
      session.needsWelcome.value = true;
      return mountWithApi(
        WelcomeView,
        api,
        {},
        { [sessionKey as symbol]: session, [localeKey as symbol]: new Locale(['es-ES']) },
      );
    });
    const problem = () => wrapper.find('[data-test="handle-problem"]').text();
    await wrapper.find('input[name="handle"]').setValue('ab');
    expect(problem()).toBe('El nombre de la página debe tener de 3 a 30 caracteres.');
    await wrapper.find('input[name="handle"]').setValue('no_good');
    expect(problem()).toContain('letras minúsculas, dígitos y «-»');
    await wrapper.find('input[name="handle"]').setValue('admin');
    expect(problem()).toBe('Ese nombre de página está reservado. Elige otro.');
  });

  it('tells the user when the handle is taken and stays on the form', async () => {
    const completeWelcome = vi
      .fn()
      .mockRejectedValue(new ApiRequestError('taken', 409, 'handle_taken'));
    const { wrapper, session } = await open({ completeWelcome });
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Another user already has that page name');
    expect(session.needsWelcome.value).toBe(true);
  });
});
