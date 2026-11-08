/** The types of the params, query string and body a route sees. */
export interface RouteShape {
  Params?: object;
  Querystring?: object;
  Body?: unknown;
}
