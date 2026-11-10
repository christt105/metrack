import type { ExecutionContext, Hono } from 'hono';
import type { ApiEnv } from '../api/ApiEnv.js';
import { createWorkerApp } from './createWorkerApp.js';
import type { WorkerEnv } from './WorkerEnv.js';

/** The Worker's `fetch`, which builds the app once per isolate and reuses it while the bindings stay the same. */
export function createWorkerHandler(): {
  fetch(request: Request, env: WorkerEnv, context: ExecutionContext): Response | Promise<Response>;
} {
  let app: Hono<ApiEnv> | undefined;
  let builtFor: WorkerEnv | undefined;
  return {
    fetch(request, env, context) {
      if (!app || builtFor !== env) {
        app = createWorkerApp(env);
        builtFor = env;
      }
      return app.fetch(request, env, context);
    },
  };
}
