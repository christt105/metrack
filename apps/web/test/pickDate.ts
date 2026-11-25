import type { DOMWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';

export async function pickDate(
  field: Pick<DOMWrapper<Element>, 'trigger'>,
  date: string,
): Promise<void> {
  await field.trigger('click');
  const dialog = document.querySelector('dialog[open]');
  if (!dialog) throw new Error('Calendar is closed');
  const findDay = () => dialog.querySelector<HTMLButtonElement>(`[data-date="${date}"]`);
  const month = date.slice(0, 7);
  const buttons = dialog.querySelectorAll<HTMLButtonElement>('.month-nav');
  let day = findDay();
  while (!day) {
    const activeMonth = dialog
      .querySelector<HTMLButtonElement>('button.day[tabindex="0"]')
      ?.dataset.date?.slice(0, 7);
    if (!activeMonth || activeMonth === month) break;
    const nav = buttons[activeMonth > month ? 0 : 1];
    if (!nav || nav.disabled) break;
    nav.click();
    await nextTick();
    day = findDay();
  }
  if (!day || day.disabled) throw new Error(`Date is unavailable in the open calendar: ${date}`);
  day.click();
  await nextTick();
}
