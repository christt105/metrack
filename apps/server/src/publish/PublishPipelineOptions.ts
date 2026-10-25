export interface PublishPipelineOptions {
  /** Hugo project the exported content is added to. It is never modified. */
  siteTemplateDir: string;
  /** Scratch directory for the assembled site and the built output. */
  workDir: string;
  hugoBinary: string;
}
