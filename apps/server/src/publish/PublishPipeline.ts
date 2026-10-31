import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildExport, fingerprintExport } from '@metrack/export';
import { loadExportInput, type ExportSources } from '../export/loadExportInput.js';
import { storeImagePath } from '../export/storeImagePath.js';
import { writeExport } from '../export/writeExport.js';
import type { CommandRunner } from './CommandRunner.js';
import { HUGO_INHERITED_ENV } from './HUGO_INHERITED_ENV.js';
import type { PublishOutcome } from './PublishOutcome.js';
import type { PublishPipelineOptions } from './PublishPipelineOptions.js';
import type { Publisher } from './Publisher.js';
import type { PublishState } from './PublishState.js';

/**
 * One publish attempt: export the stored data, skip everything if it equals what is online,
 * otherwise assemble the Hugo site, build it and hand it to the publisher.
 */
export class PublishPipeline {
  constructor(
    private readonly sources: ExportSources,
    private readonly options: PublishPipelineOptions,
    private readonly runner: CommandRunner,
    private readonly publisher: Publisher,
    private readonly state: PublishState,
  ) {}

  async run(): Promise<PublishOutcome> {
    const files = buildExport(loadExportInput(this.sources));
    const fingerprint = fingerprintExport(files);
    if (fingerprint === this.state.lastFingerprint()) return 'unchanged';

    const siteDir = join(this.options.workDir, 'site');
    const builtDir = join(this.options.workDir, 'public');
    rmSync(siteDir, { recursive: true, force: true });
    rmSync(builtDir, { recursive: true, force: true });
    mkdirSync(this.options.workDir, { recursive: true });
    cpSync(this.options.siteTemplateDir, siteDir, { recursive: true });
    writeExport(files, siteDir, storeImagePath(this.sources.images));

    const baseUrlArgs = this.options.baseUrl ? ['--baseURL', this.options.baseUrl] : [];
    await this.runner.run(this.options.hugoBinary, ['--minify', '--destination', builtDir, ...baseUrlArgs], {
      cwd: siteDir,
      inheritEnv: HUGO_INHERITED_ENV,
    });
    await this.publisher.publish(builtDir);
    this.state.record(fingerprint);
    return 'published';
  }
}
