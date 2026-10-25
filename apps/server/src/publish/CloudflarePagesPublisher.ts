import type { CommandRunner } from './CommandRunner.js';
import type { PublishConfig } from './PublishConfig.js';
import type { Publisher } from './Publisher.js';

/** Exact wrangler release run through npx; bump it deliberately. */
export const WRANGLER_VERSION = '4.152.0';

export const WRANGLER_PACKAGE = `wrangler@${WRANGLER_VERSION}`;

/** Parent environment variables wrangler and npx need: paths, locale, npm cache, proxies and CAs. */
export const WRANGLER_INHERITED_ENV: readonly string[] = [
  'PATH',
  'HOME',
  'TMPDIR',
  'LANG',
  'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME',
  'npm_config_cache',
  'NPM_CONFIG_CACHE',
  'npm_config_registry',
  'NPM_CONFIG_REGISTRY',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
];

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
        inheritEnv: WRANGLER_INHERITED_ENV,
      },
    );
  }
}
