import type { RouteFlags } from './RouteFlags.js';

/** Per-route settings: guard flags, schemas that params, query and body are checked against, and body limits. */
export interface RouteOptions {
  config?: RouteFlags;
  schema?: { params?: object; querystring?: object; body?: object };
  /** Largest body accepted, in bytes. */
  bodyLimit?: number;
  /** Content types read as raw bytes instead of being refused. */
  rawBodyTypes?: RegExp;
}
