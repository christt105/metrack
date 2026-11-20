import { describe, expect, it } from 'vitest';
import HelpView from '../src/views/HelpView.vue';
import { en } from '../src/i18n/messages/en';
import { es } from '../src/i18n/messages/es';
import { routes } from '../src/router/routes';
import { mountWithApi } from './mountWithApi';

describe('HelpView', () => {
  it('shows every section of the guide', async () => {
    const { wrapper } = await mountWithApi(HelpView, {});
    expect(wrapper.find('h1').text()).toBe(en.help.title);
    const headings = wrapper.findAll('h2').map((h) => h.text());
    expect(headings).toEqual(en.help.sections.map((section) => section.title));
  });

  it('links the sections that live in Settings to their group', async () => {
    const { wrapper, router } = await mountWithApi(HelpView, {});
    await wrapper.get('[data-test="help-settings-following"]').trigger('click');
    await new Promise((resolve) => setTimeout(resolve));
    expect(router.currentRoute.value.name).toBe('settings');
    expect(router.currentRoute.value.hash).toBe('#connections');
  });

  it('registers the route and has both languages with the same sections', () => {
    expect(routes.some((route) => route.path === '/help' && route.name === 'help')).toBe(true);
    expect(es.help.sections.map((s) => s.id)).toEqual(en.help.sections.map((s) => s.id));
  });
});
