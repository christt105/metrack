import type { InjectionKey } from 'vue';
import type { Locale } from './Locale';

export const localeKey: InjectionKey<Locale> = Symbol('locale');
