import { DOMWrapper, enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DatePicker from '../src/components/DatePicker.vue';
import { Locale } from '../src/i18n/Locale';
import { localeKey } from '../src/i18n/localeKey';

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 15));
});
afterEach(() => vi.useRealTimers());

const render = (
  props: {
    modelValue: string;
    max?: string;
    required?: boolean;
    disabled?: boolean;
  },
  languages: readonly string[] = ['en-US'],
) =>
  mount(DatePicker, {
    attachTo: document.body,
    props,
    global: { provide: { [localeKey as symbol]: new Locale(languages) } },
  });

function calendar() {
  const dialog = document.querySelector('dialog[open]');
  if (!dialog) throw new Error('Calendar is closed');
  return new DOMWrapper(dialog);
}

describe('DatePicker', () => {
  it.each([
    ['2026-11-01', 'noviembre de 2026', '2026-10-26', '2026-11-01'],
    ['2027-02-01', 'febrero de 2027', '2027-02-01', '2027-02-07'],
  ])('starts the week on Monday for %s', async (date, month, first, last) => {
    const wrapper = render({ modelValue: date }, ['es-ES']);
    await wrapper.get('input').trigger('click');
    const grid = calendar();
    expect(grid.get('h2').text()).toBe(month);
    expect(grid.findAll('[role="columnheader"]').map((day) => day.text())).toEqual([
      'Lun',
      'Mar',
      'Mié',
      'Jue',
      'Vie',
      'Sáb',
      'Dom',
    ]);
    const firstRow = grid.findAll('[role="row"]')[1]!.findAll('button.day');
    expect(firstRow[0]!.attributes('data-date')).toBe(first);
    expect(firstRow[6]!.attributes('data-date')).toBe(last);
    expect(firstRow[0]!.attributes('aria-label')).toMatch(/^lunes/);
  });

  it('keeps Monday first with English names on an English browser', async () => {
    const wrapper = render({ modelValue: '2026-11-01' });
    await wrapper.get('input').trigger('click');
    const grid = calendar();
    expect(grid.get('h2').text()).toBe('November 2026');
    expect(grid.findAll('[role="columnheader"]').map((day) => day.text())).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    const firstDay = grid.findAll('[role="row"]')[1]!.findAll('button.day')[0]!;
    expect(firstDay.attributes('data-date')).toBe('2026-10-26');
    expect(firstDay.attributes('aria-label')).toMatch(/^Monday/);
  });

  it('disables days after max and blocks an existing value after max from form submission', async () => {
    const wrapper = render({ modelValue: '2026-11-13', max: '2026-11-12' });
    const input = wrapper.get('input');
    await input.trigger('click');
    expect((input.element as HTMLInputElement).checkValidity()).toBe(false);
    const dialog = calendar();
    expect(dialog.get('[data-date="2026-11-12"]').attributes('disabled')).toBeUndefined();
    expect(dialog.get('[data-date="2026-11-13"]').attributes('disabled')).toBeDefined();
    expect(dialog.get('button[aria-label="Next month"]').attributes('disabled')).toBeDefined();
    expect(dialog.findAll('.date-actions button')[0]!.attributes('disabled')).toBeDefined();
  });

  it('selects, clears, and jumps to today through the model', async () => {
    const wrapper = render({ modelValue: '' });
    const input = wrapper.get('input');
    await input.trigger('click');
    await calendar().get('[data-date="2026-11-14"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-11-14']]);
    expect(input.attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(input.element);
    await wrapper.setProps({ modelValue: '2026-11-14' });
    expect((input.element as HTMLInputElement).value).toBe('14/11/2026');

    await input.trigger('click');
    await calendar().findAll('.date-actions button')[1]!.trigger('click');
    await input.trigger('click');
    await calendar().findAll('.date-actions button')[0]!.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-11-14'], [''], ['2026-11-15']]);
  });

  it('moves through months and uses arrow keys and Enter across a month boundary', async () => {
    const wrapper = render({ modelValue: '2026-11-01' });
    await wrapper.get('input').trigger('keydown', { key: 'Enter' });
    const dialog = calendar();
    expect(dialog.get('h2').text()).toBe('November 2026');
    await dialog.get('[aria-label="Previous month"]').trigger('click');
    expect(dialog.get('h2').text()).toBe('October 2026');
    await dialog.get('[aria-label="Next month"]').trigger('click');
    expect(dialog.get('h2').text()).toBe('November 2026');
    await dialog.get('[data-date="2026-11-01"]').trigger('keydown', { key: 'ArrowLeft' });
    expect(dialog.get('h2').text()).toBe('October 2026');
    const selected = dialog.get('[data-date="2026-10-31"]');
    expect(document.activeElement).toBe(selected.element);
    await selected.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-10-31']]);
  });

  it('dismisses on outside click or Escape without changing the date', async () => {
    const wrapper = render({ modelValue: '2026-11-02' });
    const input = wrapper.get('input');
    await input.trigger('click');
    await calendar().trigger('click');
    expect(input.attributes('aria-expanded')).toBe('false');
    await input.trigger('click');
    await calendar().trigger('keydown', { key: 'Escape' });
    expect(input.attributes('aria-expanded')).toBe('false');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('opens on today when a stored date is invalid', async () => {
    const wrapper = render({ modelValue: '2026-02-30' });
    const input = wrapper.get('input');
    expect((input.element as HTMLInputElement).value).toBe('');
    await input.trigger('click');
    expect(calendar().get('[data-date="2026-11-15"]').attributes('tabindex')).toBe('0');
  });

  it('keeps required fields valid only with a date and does not open when disabled', async () => {
    const wrapper = render({ modelValue: '', required: true });
    const input = wrapper.get('input');
    expect((input.element as HTMLInputElement).checkValidity()).toBe(false);
    await input.trigger('click');
    expect(
      calendar()
        .findAll('.date-actions button')
        .map((button) => button.text()),
    ).toEqual(['Today', 'Cancel']);
    await wrapper.setProps({ disabled: true });
    await input.trigger('click');
    expect(input.attributes('aria-expanded')).toBe('false');
  });
});
