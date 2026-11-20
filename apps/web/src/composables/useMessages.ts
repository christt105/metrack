import type { Messages } from '../i18n/messages/Messages';
import { useLocale } from './useLocale';

/** The dictionary of the active language. Every read goes to the current language, so templates and computed values follow language changes. */
export function useMessages(): Messages {
  const locale = useLocale();
  return new Proxy({} as Messages, {
    get: (_target, key) => Reflect.get(locale.messages, key),
    has: (_target, key) => Reflect.has(locale.messages, key),
    ownKeys: () => Reflect.ownKeys(locale.messages),
    getOwnPropertyDescriptor: (_target, key) => {
      const value = Reflect.get(locale.messages, key);
      return value === undefined ? undefined : { value, enumerable: true, configurable: true };
    },
  });
}
