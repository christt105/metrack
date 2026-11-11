/** The static assets binding: answers a request with the matching built file, or a 404. */
export interface Fetcher {
  fetch(request: Request): Promise<Response>;
}
