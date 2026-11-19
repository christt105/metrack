const WORKER_PATH = /^\/(api(\/|$)|u(\/|$)|privacy\/?$|assets\/)/;

/** Whether a path belongs to the web app (its HTML, or a static file) rather than to a Worker route. */
export function isAppPath(path: string): boolean {
  return !WORKER_PATH.test(path);
}
