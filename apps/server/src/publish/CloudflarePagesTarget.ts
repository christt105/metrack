import type { PublishConfig } from './PublishConfig.js';

/** The account a site is uploaded with and the project it goes to. */
export interface CloudflarePagesTarget extends Pick<
  PublishConfig,
  'wranglerBinary' | 'cloudflareApiToken' | 'cloudflareAccountId' | 'cloudflareBranch'
> {
  cloudflareProject: string;
}
