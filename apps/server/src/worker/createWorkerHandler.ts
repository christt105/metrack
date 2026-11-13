import type { ExecutionContext, Hono } from 'hono';
import type { ApiEnv } from '../api/ApiEnv.js';
import { createWorkerApp } from './createWorkerApp.js';
import { createWorkerServices } from './createWorkerServices.js';
import { serveAsset } from './serveAsset.js';
import type { ScheduledController } from './ScheduledController.js';
import type { WorkerEnv } from './WorkerEnv.js';
import type { WorkerServices } from './WorkerServices.js';

/**
 * The Worker's `fetch` and `scheduled` handlers. They build their services once per isolate and reuse them
 * while the bindings stay the same; the Hono app is only built when a request needs it, so a cron tick does
 * not pay for the routes.
 */
export function createWorkerHandler(): {
  fetch(request: Request, env: WorkerEnv, context: ExecutionContext): Response | Promise<Response>;
  scheduled(
    controller: ScheduledController,
    env: WorkerEnv,
    context: ExecutionContext,
  ): Promise<void>;
} {
  let services: WorkerServices | undefined;
  let app: Hono<ApiEnv> | undefined;
  let builtFor: WorkerEnv | undefined;

  function servicesFor(env: WorkerEnv): WorkerServices {
    if (!services || builtFor !== env) {
      services = createWorkerServices(env);
      app = undefined;
      builtFor = env;
    }
    return services;
  }

  return {
    fetch(request, env, context) {
      if (new URL(request.url).pathname.startsWith('/assets/')) return serveAsset(request, env);
      const current = servicesFor(env);
      app ??= createWorkerApp(env, undefined, current);
      return app.fetch(request, env, context);
    },
    async scheduled(controller, env) {
      try {
        await servicesFor(env).scheduled.run(controller.scheduledTime);
      } catch (error) {
        console.error(
          `scheduled tick failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}
