/** The ntfy.sh address that opens a topic in the ntfy app or in the browser. */
export function ntfySubscriptionUrl(topic: string): string {
  return `https://ntfy.sh/${encodeURIComponent(topic)}`;
}
