import type { CommandRunner } from './CommandRunner.js';
import type { PublishConfig } from './PublishConfig.js';
import type { Publisher } from './Publisher.js';

export const WRANGLER_PACKAGE = 'wrangler@4';

/** Uploads a built site to Cloudflare Pages with `wrangler pages deploy` (direct upload). */
export class CloudflarePagesPublisher implements Publisher {
  constructor(
    private readonly config: Pick<
      PublishConfig,
      'cloudflareApiToken' | 'cloudflareAccountId' | 'cloudflareProject' | 'cloudflareBranch'
    >,
    private readonly runner: CommandRunner,
  ) {}

  async publish(siteDir: string): Promise<void> {
    await this.runner.run(
      'npx',
      [
        '--yes',
        WRANGLER_PACKAGE,
        'pages',
        'deploy',
        siteDir,
        '--project-name',
        this.config.cloudflareProject,
        '--branch',
        this.config.cloudflareBranch,
        '--commit-dirty=true',
      ],
      {
        env: {
          CLOUDFLARE_API_TOKEN: this.config.cloudflareApiToken,
          CLOUDFLARE_ACCOUNT_ID: this.config.cloudflareAccountId,
        },
      },
    );
  }
}
