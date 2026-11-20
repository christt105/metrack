import { describe, expect, it } from 'vitest';
import { Locale } from '../src/i18n/Locale';
import { en } from '../src/i18n/messages/en';

describe('Locale', () => {
  it('picks Spanish when the first matching browser language is Spanish', () => {
    expect(new Locale(['es-ES', 'en']).language.value).toBe('es');
  });

  it('picks English for English and for unknown languages', () => {
    expect(new Locale(['en-GB']).language.value).toBe('en');
    expect(new Locale(['fr', 'de']).language.value).toBe('en');
    expect(new Locale([]).language.value).toBe('en');
  });

  it('skips languages the app does not offer', () => {
    expect(new Locale(['fr', 'es']).language.value).toBe('es');
  });

  it('changes language with setLanguage', () => {
    const locale = new Locale(['en']);
    locale.setLanguage('es');
    expect(locale.language.value).toBe('es');
  });

  it('serves the dictionary of the language', () => {
    expect(new Locale(['en']).messages).toBe(en);
  });
});
