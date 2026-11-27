import { fakeApi } from './fakeApi';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@metrack/domain';
import ManualAddForm from '../src/components/ManualAddForm.vue';
import { Session } from '../src/auth/Session';
import { sessionKey } from '../src/auth/sessionKey';
import { mountWithApi } from './mountWithApi';

function sessionOf(user: User): Session {
  const session = new Session(fakeApi({}));
  session.signedIn(user);
  return session;
}

describe('ManualAddForm', () => {
  it('lets a trusted user add by hand', async () => {
    const { wrapper } = await mountWithApi(
      ManualAddForm,
      { library: { create: vi.fn() } },
      { collection: 'games' },
      { [sessionKey as symbol]: sessionOf({ id: 2, name: 'T', email: null, role: 'trusted' }) },
    );
    expect(wrapper.find('form').exists()).toBe(true);
  });

  it('tells a normal user to ask the owner instead of showing the form', async () => {
    const { wrapper } = await mountWithApi(
      ManualAddForm,
      { library: { create: vi.fn() } },
      { collection: 'games' },
      { [sessionKey as symbol]: sessionOf({ id: 3, name: 'N', email: null, role: 'normal' }) },
    );
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.text()).toContain('Only trusted users can add items');
  });
});
