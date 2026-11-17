import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { AnyDetail } from '../src/api/AnyDetail';
import ReviewPanel from '../src/components/ReviewPanel.vue';
import { mountWithApi } from './mountWithApi';

const movie = { id: 4, title: 'Heat', review: 'Tense and clean.' } as unknown as AnyDetail;

describe('ReviewPanel', () => {
  it('shows the review once, as a quote, with an edit button', async () => {
    const { wrapper } = await mountWithApi(
      ReviewPanel,
      {},
      { collection: 'movies', detail: movie },
    );
    expect(wrapper.findAll('blockquote')).toHaveLength(1);
    expect(wrapper.find('textarea').exists()).toBe(false);
    expect(wrapper.find('.edit-review').text()).toBe('Edit review');
  });

  it('turns the quote into a textarea in place and saves it', async () => {
    const patch = vi.fn().mockResolvedValue({ ...movie, review: 'Better.' });
    const { wrapper } = await mountWithApi(
      ReviewPanel,
      { patch },
      { collection: 'movies', detail: movie },
    );
    await wrapper.find('.edit-review').trigger('click');
    expect(wrapper.find('blockquote').exists()).toBe(false);
    const field = wrapper.find('textarea');
    expect((field.element as HTMLTextAreaElement).value).toBe('Tense and clean.');
    await field.setValue('  Better.  ');
    await wrapper.find('button.primary').trigger('click');
    await flushPromises();
    expect(patch).toHaveBeenCalledWith('movies', 4, { review: 'Better.' }, {});
    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect(wrapper.find('textarea').exists()).toBe(false);
  });

  it('cancels without saving', async () => {
    const patch = vi.fn();
    const { wrapper } = await mountWithApi(
      ReviewPanel,
      { patch },
      { collection: 'movies', detail: movie },
    );
    await wrapper.find('.edit-review').trigger('click');
    await wrapper.find('textarea').setValue('changed');
    const cancel = wrapper.findAll('button').find((b) => b.text() === 'Cancel');
    await cancel?.trigger('click');
    expect(patch).not.toHaveBeenCalled();
    expect(wrapper.find('blockquote').text()).toContain('Tense and clean.');
  });

  it('offers to add a review when there is none and clears with a blank one', async () => {
    const patch = vi.fn().mockResolvedValue({ ...movie, review: null });
    const { wrapper } = await mountWithApi(
      ReviewPanel,
      { patch },
      { collection: 'movies', detail: movie },
    );
    await wrapper.find('.edit-review').trigger('click');
    await wrapper.find('textarea').setValue('   ');
    await wrapper.find('button.primary').trigger('click');
    await flushPromises();
    expect(patch).toHaveBeenCalledWith('movies', 4, { review: null }, {});
    const empty = await mountWithApi(
      ReviewPanel,
      {},
      { collection: 'movies', detail: { ...movie, review: null } as AnyDetail },
    );
    expect(empty.wrapper.find('blockquote').exists()).toBe(false);
    expect(empty.wrapper.find('.edit-review').text()).toBe('Add review');
  });

  it('saves a pending review as a draft or publishes it', async () => {
    const pending = { ...movie, pendingReview: true } as AnyDetail;
    const patch = vi.fn().mockResolvedValue(pending);
    const { wrapper } = await mountWithApi(
      ReviewPanel,
      { patch },
      { collection: 'movies', detail: pending },
    );
    await wrapper.find('.edit-review').trigger('click');
    expect(wrapper.text()).toContain('stay out of the public page');
    expect(wrapper.find('button.publish').text()).toBe('Save and publish');
    await wrapper.find('textarea').setValue('Draft');
    await wrapper.find('button.save').trigger('click');
    await flushPromises();
    expect(patch).toHaveBeenLastCalledWith('movies', 4, { review: 'Draft' }, {});
    await wrapper.find('.edit-review').trigger('click');
    await wrapper.find('textarea').setValue('Final');
    await wrapper.find('button.publish').trigger('click');
    await flushPromises();
    expect(patch).toHaveBeenLastCalledWith(
      'movies',
      4,
      { review: 'Final', pendingReview: false },
      {},
    );
  });

  it('shows a single Save when the item is not pending', async () => {
    const { wrapper } = await mountWithApi(
      ReviewPanel,
      {},
      { collection: 'movies', detail: movie },
    );
    await wrapper.find('.edit-review').trigger('click');
    expect(wrapper.find('button.publish').exists()).toBe(false);
    expect(wrapper.find('button.save').text()).toBe('Save');
  });
});
