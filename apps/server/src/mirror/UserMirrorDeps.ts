import type { ExportSources } from '../export/loadExportInput.js';
import type { UserJobContext } from '../users/UserJobContext.js';

export interface UserMirrorDeps {
  /** Scoped repositories: each run reads the data of the user it runs as. */
  sources: ExportSources;
  dataDir: string;
  /** Address of the metrack web app, for the link back from each note. */
  webUrl: string | null;
  jobs: UserJobContext;
}
