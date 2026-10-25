import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { UnlinkedTitle } from '@metrack/domain';
import UnlinkedRow from '../src/components/UnlinkedRow.vue';
import { mountWithApi } from './mountWithApi';

const title: UnlinkedTitle = {
  id: 5,
  mediaType: 'series',
  title: 'Odd Show',
  year: 2020,
  source: 'jellyfin',
  sourceRef: null,
  createdAt: '2026-10-01',
};

describe('UnlinkedRow', () => {
  it('asks for an id before resolving', async () => {
    const resolveUnlinked = vi.fn();
    const { wrapper } = await mountWithApi(UnlinkedRow, { resolveUnlinked }, { title });
    await wrapper.find('form').trigger('submit');
    expect(resolveUnlinked).not.toHaveBeenCalled();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  });

  it('resolves with the typed ids and links to the new entity', async () => {
    const resolveUnlinked = vi.fn().mockResolvedValue({ type: 'series', id: 8, refresh: null });
    const { wrapper } = await mountWithApi(UnlinkedRow, { resolveUnlinked }, { title });
    await wrapper.find('input[type="number"]').setValue('1399');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(resolveUnlinked).toHaveBeenCalledWith(5, { ids: { tmdbId: 1399 } });
    expect(wrapper.find('a').attributes('href')).toBe('/series/8');
  });

  it('only offers dismiss for a season', async () => {
    const { wrapper } = await mountWithApi(
      UnlinkedRow,
      {},
      { title: { ...title, mediaType: 'season' } },
    );
    expect(wrapper.find('form').exists()).toBe(false);
  });
});
