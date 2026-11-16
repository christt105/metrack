import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import RatingBadge from '../src/components/RatingBadge.vue';
import RatingPicker from '../src/components/RatingPicker.vue';

describe('RatingPicker', () => {
  it('offers the seven levels, best first, with a word each, plus no rating', () => {
    const wrapper = mount(RatingPicker, { props: { modelValue: 4 } });
    const options = wrapper.findAll('[role="radio"]');
    expect(options.map((o) => o.text())).toEqual([
      'Masterpiece',
      'Amazing',
      'Good',
      'Decent',
      'Bad',
      'Terrible',
      'Abysmal',
      'No rating',
    ]);
    expect(options.map((o) => o.attributes('aria-checked'))).toEqual([
      'false',
      'false',
      'false',
      'true',
      'false',
      'false',
      'false',
      'false',
    ]);
  });

  it('emits the stored integer on one tap and null for no rating', async () => {
    const wrapper = mount(RatingPicker, { props: { modelValue: null } });
    await wrapper.find('[data-rating="6"]').trigger('click');
    await wrapper.find('[data-rating="none"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[6], [null]]);
  });
});

describe('RatingBadge', () => {
  it('shows icon and word, never the number', () => {
    const wrapper = mount(RatingBadge, { props: { rating: 5 } });
    expect(wrapper.text()).toBe('Good');
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('keeps an accessible label when compact', () => {
    const wrapper = mount(RatingBadge, { props: { rating: 7, compact: true } });
    expect(wrapper.find('.visually-hidden').text()).toBe('Masterpiece');
    expect(wrapper.attributes('title')).toBe('Masterpiece');
  });

  it('renders a legacy value neutrally without crashing', () => {
    const wrapper = mount(RatingBadge, { props: { rating: 8.5 } });
    expect(wrapper.text()).toBe('Rated');
    expect(wrapper.text()).not.toContain('8');
  });
});
