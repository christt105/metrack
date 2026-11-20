/** The ntfy:// deep link that the Android ntfy app opens, subscribing to the topic if needed. */
export function ntfyAppUrl(topic: string): string {
  return `ntfy://ntfy.sh/${encodeURIComponent(topic)}`;
}
