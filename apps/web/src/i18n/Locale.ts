import { ref, type Ref } from 'vue';
import { en } from './messages/en';
import type { Messages } from './messages/Messages';
import type { Language } from './Language';

const DICTIONARIES: Record<Language, Messages> = { en, es: en };

/** The language of the interface and the dictionary that goes with it. */
export class Locale {
  readonly language: Ref<Language>;

  constructor(languages: readonly string[] = []) {
    this.language = ref(Locale.detect(languages));
  }

  get messages(): Messages {
    return DICTIONARIES[this.language.value];
  }

  setLanguage(language: Language): void {
    this.language.value = language;
  }

  /** The first browser language the app offers, English when none matches. */
  static detect(languages: readonly string[]): Language {
    for (const tag of languages) {
      const base = tag.toLowerCase().split('-')[0];
      if (base === 'es') return 'es';
      if (base === 'en') return 'en';
    }
    return 'en';
  }
}
