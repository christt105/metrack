/** The built web app, as files the server can answer with. */
export interface StaticFiles {
  /** The file at a URL path, or undefined when there is none. */
  file(pathname: string, request: Request): Promise<Response | undefined>;
  /** The page every address of the web app falls back to. */
  index(request: Request): Promise<Response | undefined>;
}
