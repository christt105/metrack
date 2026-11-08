import { buildApp, type AppDeps } from '../../src/api/buildApp.js';
import type { InjectOptions } from './InjectOptions.js';
import type { InjectResponse } from './InjectResponse.js';
import type { TestApp } from './TestApp.js';

async function inject(app: TestApp, options: InjectOptions): Promise<InjectResponse> {
  const headers = new Headers({ host: 'localhost:80', ...options.headers });
  let body: BodyInit | undefined;
  const payload = options.payload;
  if (payload instanceof Uint8Array) {
    body = payload as Uint8Array<ArrayBuffer>;
  } else if (typeof payload === 'string') {
    body = payload;
  } else if (payload !== undefined) {
    body = JSON.stringify(payload);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  }
  const response = await app.request(`http://localhost${options.url}`, {
    method: options.method,
    headers,
    body,
  });
  const rawPayload = Buffer.from(await response.arrayBuffer());
  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers),
    body: rawPayload.toString('utf8'),
    rawPayload,
    json: () => JSON.parse(rawPayload.toString('utf8')),
  };
}

/** `buildApp` with `inject`, the way the API tests send requests. */
export function buildTestApp(deps: AppDeps): TestApp {
  const app = buildApp(deps) as TestApp;
  app.inject = (options) => inject(app, options);
  app.close = async () => {};
  return app;
}
