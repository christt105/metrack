import type { Hono } from 'hono';
import type { ApiEnv } from './ApiEnv.js';
import { jsonResponse } from './jsonResponse.js';
import { DEFAULT_BODY_LIMIT, readRequestBody } from './readRequestBody.js';
import type { RouteFlags } from './RouteFlags.js';
import type { RouteHandler } from './RouteHandler.js';
import type { RouteOptions } from './RouteOptions.js';
import type { RouteRequest } from './RouteRequest.js';
import type { RouteShape } from './RouteShape.js';
import { validateInput } from './validation/validateInput.js';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function queryOf(url: URL): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams) {
    const current = query[key];
    if (current === undefined) query[key] = value;
    else query[key] = Array.isArray(current) ? [...current, value] : [current, value];
  }
  return query;
}

/**
 * Registers `/api` routes on a Hono app, remembering the guard flags of each so the auth guard can look them up
 * by the route that matched, and checking params, query and body against the route's schemas before the handler runs.
 */
export class ApiRoutes {
  private readonly flags = new Map<string, RouteFlags>();

  constructor(readonly app: Hono<ApiEnv>) {}

  /** The flags of the route registered for this method and path pattern; none when it was not registered here. */
  flagsOf(method: string, path: string): RouteFlags {
    return this.flags.get(`${method} ${path}`) ?? {};
  }

  get<S extends RouteShape = RouteShape>(path: string, handler: RouteHandler<S>): void;
  get<S extends RouteShape = RouteShape>(
    path: string,
    options: RouteOptions,
    handler: RouteHandler<S>,
  ): void;
  get(path: string, a: RouteOptions | RouteHandler<never>, b?: RouteHandler<never>): void {
    this.add('GET', path, a, b);
  }

  post<S extends RouteShape = RouteShape>(path: string, handler: RouteHandler<S>): void;
  post<S extends RouteShape = RouteShape>(
    path: string,
    options: RouteOptions,
    handler: RouteHandler<S>,
  ): void;
  post(path: string, a: RouteOptions | RouteHandler<never>, b?: RouteHandler<never>): void {
    this.add('POST', path, a, b);
  }

  put<S extends RouteShape = RouteShape>(path: string, handler: RouteHandler<S>): void;
  put<S extends RouteShape = RouteShape>(
    path: string,
    options: RouteOptions,
    handler: RouteHandler<S>,
  ): void;
  put(path: string, a: RouteOptions | RouteHandler<never>, b?: RouteHandler<never>): void {
    this.add('PUT', path, a, b);
  }

  patch<S extends RouteShape = RouteShape>(path: string, handler: RouteHandler<S>): void;
  patch<S extends RouteShape = RouteShape>(
    path: string,
    options: RouteOptions,
    handler: RouteHandler<S>,
  ): void;
  patch(path: string, a: RouteOptions | RouteHandler<never>, b?: RouteHandler<never>): void {
    this.add('PATCH', path, a, b);
  }

  delete<S extends RouteShape = RouteShape>(path: string, handler: RouteHandler<S>): void;
  delete<S extends RouteShape = RouteShape>(
    path: string,
    options: RouteOptions,
    handler: RouteHandler<S>,
  ): void;
  delete(path: string, a: RouteOptions | RouteHandler<never>, b?: RouteHandler<never>): void {
    this.add('DELETE', path, a, b);
  }

  private add(
    method: Method,
    path: string,
    a: RouteOptions | RouteHandler<never>,
    b?: RouteHandler<never>,
  ): void {
    const options: RouteOptions = typeof a === 'function' ? {} : a;
    const handler = (typeof a === 'function' ? a : b) as RouteHandler;
    this.flags.set(`${method} ${path}`, options.config ?? {});
    this.app.on(method, path, async (context) => {
      const url = new URL(context.req.url);
      const body = await readRequestBody(context.req.raw, {
        limit: options.bodyLimit ?? DEFAULT_BODY_LIMIT,
        rawTypes: options.rawBodyTypes,
      });
      const schema = options.schema;
      const params = schema?.params
        ? validateInput('params', schema.params, { ...context.req.param() })
        : { ...context.req.param() };
      const checkedBody = schema?.body ? validateInput('body', schema.body, body) : body;
      const query = schema?.querystring
        ? validateInput('querystring', schema.querystring, queryOf(url))
        : queryOf(url);
      const request: RouteRequest = {
        user: context.get('user') ?? null,
        params: params as Record<string, string>,
        query: query as Record<string, string>,
        body: checkedBody,
        method,
        url,
        headers: context.req.raw.headers,
        context,
      };
      const result = await handler(request);
      return result instanceof Response ? result : jsonResponse(result);
    });
  }
}
