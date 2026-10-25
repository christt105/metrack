/** Delivers an operational alert to a human. Implementations must not throw. */
export interface Notifier {
  notify(title: string, message: string): Promise<void>;
}
