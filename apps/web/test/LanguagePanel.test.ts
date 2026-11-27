import { fakeApi } from './fakeApi';
import type { UserSettings } from '@metrack/domain';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import LanguagePanel from '../src/components/LanguagePanel.vue';
import { Locale } from '../src/i18n/Locale';
import { localeKey } from '../src/i18n/localeKey';
import { Session } from '../src/auth/Session';
import { sessionKey } from '../src/auth/sessionKey';
import { mountWithApi } from './mountWithApi';

const settings: Omit<UserSettings, 'language'> = {
  steamId: null,
  jellyfinUser: null,
  ntfyTopic: null,
  mirrorDir: null,
  mirrorLinkPrefix: null,
};

describe('LanguagePanel', () => {
  it('offers automatic, Spanish and English in English', async () => {
    const { wrapper } = await mountWithApi(LanguagePanel, {}, { language: null });
    const options = wrapper.findAll('option').map((option) => option.text());
    expect(options).toEqual(['Automatic', 'Español', 'English']);
    expect(wrapper.text()).toContain('Interface language');
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('');
  });

  it('offers the same choices in Spanish', async () => {
    const { wrapper } = await mountWithApi(
      LanguagePanel,
      {},
      { language: 'es' },
      { [localeKey as symbol]: new Locale(['es-ES']) },
    );
    expect(wrapper.findAll('option').map((option) => option.text())).toEqual([
      'Automático',
      'Español',
      'English',
    ]);
    expect(wrapper.text()).toContain('Idioma de la interfaz');
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('es');
  });

  it('saves the choice and tells the session', async () => {
    const updateLanguage = vi.fn().mockResolvedValue({ ...settings, language: 'es' });
    const session = new Session(fakeApi({}));
    const { wrapper } = await mountWithApi(
      LanguagePanel,
      { updateLanguage },
      { language: null },
      { [sessionKey as symbol]: session },
    );
    await wrapper.find('select').setValue('es');
    await flushPromises();
    expect(updateLanguage).toHaveBeenCalledWith('es');
    expect(session.language.value).toBe('es');
  });

  it('sends null for automatic', async () => {
    const updateLanguage = vi.fn().mockResolvedValue({ ...settings, language: null });
    const { wrapper } = await mountWithApi(LanguagePanel, { updateLanguage }, { language: 'en' });
    await wrapper.find('select').setValue('');
    await flushPromises();
    expect(updateLanguage).toHaveBeenCalledWith(null);
  });

  it('shows the error and keeps the previous choice when saving fails', async () => {
    const updateLanguage = vi.fn().mockRejectedValue(new Error('boom'));
    const { wrapper } = await mountWithApi(LanguagePanel, { updateLanguage }, { language: 'en' });
    await wrapper.find('select').setValue('es');
    await flushPromises();
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('en');
    expect(wrapper.text()).toContain('boom');
  });
});
