import type { RouteRequest } from './RouteRequest.js';
import type { RouteShape } from './RouteShape.js';

/** Answers with a `Response`, or with any value to send it as JSON with status 200. */
export type RouteHandler<S extends RouteShape = RouteShape> = (
  request: RouteRequest<S>,
) => unknown | Promise<unknown>;
