import { config } from '@vue/test-utils';
import { Locale } from '../src/i18n/Locale';
import { localeKey } from '../src/i18n/localeKey';

config.global.provide = { [localeKey as symbol]: new Locale(['en']) };
