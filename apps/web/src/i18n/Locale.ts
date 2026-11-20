import { ref, type Ref } from 'vue';
import { en } from './messages/en';
import { es } from './messages/es';
import type { Messages } from './messages/Messages';
import type { Language } from './Language';

const DICTIONARIES: Record<Language, Messages> = { en, es };

/** The language of the interface and the dictionary that goes with it. */
export class Locale {
  readonly language: Ref<Language>;

  private readonly browser: Language;

  constructor(languages: readonly string[] = []) {
    this.browser = Locale.detect(languages);
    this.language = ref(this.browser);
  }

  get messages(): Messages {
    return DICTIONARIES[this.language.value];
  }

  setLanguage(language: Language): void {
    this.language.value = language;
  }

  /** Uses the language the user chose, or the browser's when they chose none. */
  prefer(language: Language | null): void {
    this.language.value = language ?? this.browser;
  }

  /** The first browser language the app offers, Spanish when none matches. */
  static detect(languages: readonly string[]): Language {
    for (const tag of languages) {
      const base = tag.toLowerCase().split('-')[0];
      if (base === 'es') return 'es';
      if (base === 'en') return 'en';
    }
    return 'es';
  }
}
