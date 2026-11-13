import type { Context } from 'hono';
import type { TokenScope, User } from '@metrack/domain';
import type { ApiEnv } from './ApiEnv.js';
import type { RouteShape } from './RouteShape.js';

type Part<S extends RouteShape, K extends keyof RouteShape, Otherwise> = S extends {
  [P in K]: infer T;
}
  ? T
  : Otherwise;

/** One request as a route handler sees it, with params, query and body already validated and converted. */
export interface RouteRequest<S extends RouteShape = RouteShape> {
  /** Who made the request; set by the auth guard on every route that is not public. */
  user: User | null;
  /** The scope of the API token the request signed in with; null for a browser session. */
  tokenScope: TokenScope | null;
  params: Part<S, 'Params', Record<string, string>>;
  query: Part<S, 'Querystring', Record<string, string | string[]>>;
  body: Part<S, 'Body', unknown>;
  method: string;
  url: URL;
  headers: Headers;
  /** The Hono context, for the few handlers that need to read more of the request. */
  context: Context<ApiEnv>;
}
