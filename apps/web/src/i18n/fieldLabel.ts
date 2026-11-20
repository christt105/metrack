import type { Messages } from './messages/Messages';

/** The label of an entity field, falling back to its key. */
export function fieldLabel(messages: Messages, key: string): string {
  return (messages.fields as Record<string, string>)[key] ?? key;
}
