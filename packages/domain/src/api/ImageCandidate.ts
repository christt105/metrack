/**
 * A cover or banner a provider offers for an entity. `thumbUrl` is only for previews in the picker;
 * choosing a candidate sends `url`, which the server downloads into its own image store.
 */
export interface ImageCandidate {
  provider: string;
  url: string;
  thumbUrl: string;
  width: number | null;
  height: number | null;
  score: number | null;
  language: string | null;
}
