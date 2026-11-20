/** An episode of a season by the key of the user's watches, with its running time in minutes when known. */
export interface EpisodeRuntime {
  key: string;
  runtime: number | null;
}
