import { describe, expect, it } from 'vitest';
import AboutPanel from '../src/components/AboutPanel.vue';
import { Locale } from '../src/i18n/Locale';
import { localeKey } from '../src/i18n/localeKey';
import { mountWithApi } from './mountWithApi';

describe('AboutPanel', () => {
  it('shows the version, the repository, the TMDB notice with its logo and the other providers', async () => {
    const { wrapper } = await mountWithApi(AboutPanel, {}, { version: '1.2.3' });
    expect(wrapper.get('[data-test="about-version"]').text()).toBe('1.2.3');
    expect(wrapper.find('a[href="https://github.com/christt105/metrack"]').exists()).toBe(true);
    expect(wrapper.get('[data-test="tmdb-notice"]').text()).toBe(
      'This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.',
    );
    const logo = wrapper.get('[data-test="tmdb-logo"]');
    expect(logo.attributes('alt')).toBe('TMDB');
    expect(logo.element.closest('a')?.getAttribute('href')).toBe('https://www.themoviedb.org');
    const credits = wrapper.get('[data-test="credits"]');
    expect(credits.text()).toContain('Data and images from');
    for (const host of ['igdb.com', 'openlibrary.org', 'steampowered.com', 'steamgriddb.com']) {
      expect(credits.find(`a[href*="${host}"]`).exists()).toBe(true);
    }
  });

  it('keeps the TMDB notice in English in Spanish', async () => {
    const { wrapper } = await mountWithApi(
      AboutPanel,
      {},
      { version: null },
      { [localeKey as symbol]: new Locale(['es-ES']) },
    );
    expect(wrapper.text()).toContain('Acerca de metrack');
    expect(wrapper.get('[data-test="credits"]').text()).toContain('Datos e imágenes de');
    expect(wrapper.get('[data-test="tmdb-notice"]').text()).toContain('This application uses TMDB');
  });
});
