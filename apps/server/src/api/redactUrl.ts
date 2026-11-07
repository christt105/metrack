import { WEBHOOK_SECRET_QUERY } from './WebhookSecret.js';

const SECRET_PARAM = new RegExp(`([?&]${WEBHOOK_SECRET_QUERY}=)[^&#]*`, 'g');

/** The request URL with the webhook secret masked, safe to log. */
export function redactUrl(url: string): string {
  return url.replace(SECRET_PARAM, '$1***');
}
