/** Puts a built static site online. A failed publish must reject so the caller can retry. */
export interface Publisher {
  publish(siteDir: string): Promise<void>;
}
