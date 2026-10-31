import type { PublishConfig } from './PublishConfig.js';

const REQUIRED = [
  'PUBLISH_SITE_TEMPLATE_DIR',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_PAGES_PROJECT',
] as const;

export interface PublishConfigResult {
  config: PublishConfig | undefined;
  /** Names of the required variables that are not set. Empty when publishing is configured. */
  missing: string[];
}

/** Reads publishing settings from the environment. Publishing is off unless all of them are set. */
export function loadPublishConfig(env: Record<string, string | undefined>): PublishConfigResult {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) return { config: undefined, missing };
  return {
    missing: [],
    config: {
      siteTemplateDir: env.PUBLISH_SITE_TEMPLATE_DIR!,
      hugoBinary: env.HUGO_BIN || 'hugo',
      wranglerBinary: env.WRANGLER_BIN || 'wrangler',
      cloudflareApiToken: env.CLOUDFLARE_API_TOKEN!,
      cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID!,
      cloudflareProject: env.CLOUDFLARE_PAGES_PROJECT!,
      cloudflareBranch: env.CLOUDFLARE_PAGES_BRANCH || 'main',
      baseUrl: env.PUBLISH_BASE_URL || undefined,
    },
  };
}
