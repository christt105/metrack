import { Hono } from 'hono';
import { WebhookSecret } from '../api/WebhookSecret.js';

export interface ConnectorAppDeps {
  /** Queues a sync for every user and resolves to how many there are. */
  onWebhook: () => Promise<number>;
  /** Required from the Jellyfin webhook when set. */
  secret?: WebhookSecret;
}

/**
 * The connector's HTTP surface. `POST /webhook` is the target of the Jellyfin Webhook plugin: it ignores the body,
 * queues a delayed sync for every user and answers 202, or 401 when the secret is set and missing or wrong.
 * `GET /api/health` answers 200 for the container health check.
 */
export function createConnectorApp(deps: ConnectorAppDeps): Hono {
  const app = new Hono();
  app.get('/api/health', (context) => context.json({ status: 'ok', mode: 'connector' }));
  app.post('/webhook', async (context) => {
    if (deps.secret && !deps.secret.matches(context.req.raw.headers, new URL(context.req.url))) {
      return context.json(
        { error: 'Missing or wrong webhook secret', code: 'bad_webhook_secret' },
        401,
      );
    }
    return context.json({ status: 'queued', users: await deps.onWebhook() }, 202);
  });
  return app;
}
