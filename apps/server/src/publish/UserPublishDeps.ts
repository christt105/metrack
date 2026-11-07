import type { ExportSources } from '../export/loadExportInput.js';
import type { UserJobContext } from '../users/UserJobContext.js';
import type { CommandRunner } from './CommandRunner.js';
import type { PublishConfig } from './PublishConfig.js';

export interface UserPublishDeps {
  config: PublishConfig;
  /** Scoped repositories: each run reads the data of the user it runs as. */
  sources: ExportSources;
  dataDir: string;
  runner: CommandRunner;
  jobs: UserJobContext;
}
