import { EMPTY_PAGE } from './EMPTY_PAGE';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import PublicPagePanel from '../src/components/PublicPagePanel.vue';
import { ApiRequestError } from '../src/api/ApiRequestError';
import type { User } from '@metrack/domain';
import type { ApiClient } from '../src/api/ApiClient';
import { Session } from '../src/auth/Session';
import { sessionKey } from '../src/auth/sessionKey';
import { mountWithApi } from './mountWithApi';

function sessionOf(role: User['role']): Session {
  const session = new Session({} as ApiClient);
  session.signedIn({ id: 2, name: 'U', email: null, role });
  return session;
}

describe('PublicPagePanel', () => {
  it('saves the handle and the switch and tells the parent', async () => {
    const updatePublicPage = vi
      .fn()
      .mockResolvedValue({ ...EMPTY_PAGE, handle: 'christian', enabled: true });
    const { wrapper } = await mountWithApi(
      PublicPagePanel,
      { updatePublicPage },
      { page: EMPTY_PAGE },
    );
    await wrapper.find('input[name="handle"]').setValue(' christian ');
    await wrapper.find('input[name="enabled"]').setValue(true);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(updatePublicPage).toHaveBeenCalledWith({
      handle: 'christian',
      enabled: true,
      avatar: null,
      intro: '',
      description: '',
      about: '',
      giscus: null,
    });
    expect(wrapper.text()).toContain('Saved.');
    expect(wrapper.emitted('saved')).toEqual([
      [{ ...EMPTY_PAGE, handle: 'christian', enabled: true }],
    ]);
  });

  it('explains a handle another user has', async () => {
    const updatePublicPage = vi
      .fn()
      .mockRejectedValue(new ApiRequestError('taken', 409, 'handle_taken'));
    const { wrapper } = await mountWithApi(
      PublicPagePanel,
      { updatePublicPage },
      { page: EMPTY_PAGE },
    );
    await wrapper.find('input[name="handle"]').setValue('christian');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Another user already has that handle.');
  });

  it('links to the page and its feed while it is on', async () => {
    const { wrapper } = await mountWithApi(
      PublicPagePanel,
      {},
      { page: { ...EMPTY_PAGE, handle: 'christian', enabled: true } },
    );
    const hrefs = wrapper.findAll('a').map((link) => link.attributes('href'));
    expect(hrefs).toEqual(['/u/christian/', '/u/christian/feed.xml']);
  });

  it('sends the texts and the four giscus values, and clears giscus when they are empty', async () => {
    const updatePublicPage = vi.fn().mockResolvedValue(EMPTY_PAGE);
    const { wrapper } = await mountWithApi(
      PublicPagePanel,
      { updatePublicPage },
      { page: EMPTY_PAGE },
    );
    await wrapper.find('input[name="intro"]').setValue('Mi sitio');
    await wrapper.find('textarea[name="about"]').setValue('## Hola');
    await wrapper.find('input[name="giscus-repo"]').setValue('ana/site');
    await wrapper.find('input[name="giscus-repo-id"]').setValue('R_1');
    await wrapper.find('input[name="giscus-category"]').setValue('Announcements');
    await wrapper.find('input[name="giscus-category-id"]').setValue('DIC_1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(updatePublicPage).toHaveBeenCalledWith(
      expect.objectContaining({
        intro: 'Mi sitio',
        about: '## Hola',
        giscus: { repo: 'ana/site', repoId: 'R_1', category: 'Announcements', categoryId: 'DIC_1' },
      }),
    );
  });

  it('lets a trusted user upload an avatar and a normal user only see the default note', async () => {
    const uploadImage = vi.fn().mockResolvedValue({ ref: '/api/images/abc' });
    const updatePublicPage = vi.fn().mockResolvedValue(EMPTY_PAGE);
    const trusted = await mountWithApi(
      PublicPagePanel,
      { uploadImage, updatePublicPage },
      { page: EMPTY_PAGE },
      { [sessionKey as symbol]: sessionOf('trusted') },
    );
    const file = new File([new Uint8Array([1])], 'me.png', { type: 'image/png' });
    const input = trusted.wrapper.find('input[type="file"]');
    Object.defineProperty(input.element, 'files', { value: [file] });
    await input.trigger('change');
    await flushPromises();
    expect(uploadImage).toHaveBeenCalledWith(file);
    await trusted.wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(updatePublicPage).toHaveBeenCalledWith(
      expect.objectContaining({ avatar: '/api/images/abc' }),
    );

    const normal = await mountWithApi(
      PublicPagePanel,
      {},
      { page: EMPTY_PAGE },
      { [sessionKey as symbol]: sessionOf('normal') },
    );
    expect(normal.wrapper.find('input[type="file"]').exists()).toBe(false);
    expect(normal.wrapper.text()).toContain('neutral avatar');
  });
});
