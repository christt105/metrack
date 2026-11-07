import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@metrack/domain';
import ImagePicker from '../src/components/ImagePicker.vue';
import type { ApiClient } from '../src/api/ApiClient';
import { Session } from '../src/auth/Session';
import { sessionKey } from '../src/auth/sessionKey';
import { mountWithApi } from './mountWithApi';

function sessionOf(role: User['role']): Session {
  const session = new Session({} as ApiClient);
  session.signedIn({ id: 2, name: 'U', email: null, role });
  return session;
}

const props = { collection: 'movies', id: 7, kind: 'cover' } as const;
const candidates = { candidates: [], failures: [] };

describe('ImagePicker', () => {
  it('offers a trusted user an upload or any address as their own cover', async () => {
    const api = {
      imageCandidates: vi.fn().mockResolvedValue(candidates),
      uploadImage: vi.fn().mockResolvedValue({ ref: '/api/images/abc' }),
      chooseImage: vi.fn().mockResolvedValue({ id: 7 }),
    };
    const { wrapper } = await mountWithApi(ImagePicker, api, props, {
      [sessionKey as symbol]: sessionOf('trusted'),
    });
    await flushPromises();
    const file = new File([new Uint8Array([1, 2, 3])], 'shot.png', { type: 'image/png' });
    const input = wrapper.find('[data-test="own-upload"]');
    Object.defineProperty(input.element, 'files', { value: [file] });
    await input.trigger('change');
    await flushPromises();
    expect(api.uploadImage).toHaveBeenCalledWith(file);
    expect(api.chooseImage).toHaveBeenCalledWith('movies', 7, 'cover', '/api/images/abc');
    expect(wrapper.emitted('chosen')).toHaveLength(1);

    await wrapper.find('[data-test="own-url"]').setValue(' https://pics.test/a.png ');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(api.chooseImage).toHaveBeenLastCalledWith(
      'movies',
      7,
      'cover',
      'https://pics.test/a.png',
    );
  });

  it('shows a normal user only the provider candidates', async () => {
    const api = { imageCandidates: vi.fn().mockResolvedValue(candidates) };
    const { wrapper } = await mountWithApi(ImagePicker, api, props, {
      [sessionKey as symbol]: sessionOf('normal'),
    });
    await flushPromises();
    expect(wrapper.find('[data-test="own-upload"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="own-url"]').exists()).toBe(false);
  });
});
