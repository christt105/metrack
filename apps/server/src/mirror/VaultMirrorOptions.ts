export interface VaultMirrorOptions {
  /** The Media Tracker folder of the vault on disk. */
  mirrorDir: string;
  /** That folder's path inside the vault, for `[[...]]` links. */
  linkPrefix: string;
  /** Address of the metrack web app, for the link back from each note. */
  webUrl: string | null;
  /** JSON file remembering which notes the mirror wrote, so it can remove them later. */
  statePath: string;
  /** Without it nothing is written and the result only describes what would change. */
  apply: boolean;
}
