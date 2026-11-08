import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import PublicPagePanel from '../src/components/PublicPagePanel.vue';
import { ApiRequestError } from '../src/api/ApiRequestError';
import { mountWithApi } from './mountWithApi';

describe('PublicPagePanel', () => {
  it('saves the handle and the switch and tells the parent', async () => {
    const updatePublicPage = vi.fn().mockResolvedValue({ handle: 'christian', enabled: true });
    const { wrapper } = await mountWithApi(
      PublicPagePanel,
      { updatePublicPage },
      { page: { handle: null, enabled: false } },
    );
    await wrapper.find('input[name="handle"]').setValue(' christian ');
    await wrapper.find('input[name="enabled"]').setValue(true);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(updatePublicPage).toHaveBeenCalledWith({ handle: 'christian', enabled: true });
    expect(wrapper.text()).toContain('Saved.');
    expect(wrapper.emitted('saved')).toEqual([[{ handle: 'christian', enabled: true }]]);
  });

  it('explains a handle another user has', async () => {
    const updatePublicPage = vi
      .fn()
      .mockRejectedValue(new ApiRequestError('taken', 409, 'handle_taken'));
    const { wrapper } = await mountWithApi(
      PublicPagePanel,
      { updatePublicPage },
      { page: { handle: null, enabled: false } },
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
      { page: { handle: 'christian', enabled: true } },
    );
    const hrefs = wrapper.findAll('a').map((link) => link.attributes('href'));
    expect(hrefs).toEqual(['/u/christian/', '/u/christian/feed.xml']);
  });
});
