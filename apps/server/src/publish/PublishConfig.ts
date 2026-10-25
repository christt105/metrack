export interface PublishConfig {
  /** A Hugo project (config, layouts, assets, data, static pages) without the exported content sections. */
  siteTemplateDir: string;
  hugoBinary: string;
  cloudflareApiToken: string;
  cloudflareAccountId: string;
  cloudflareProject: string;
  /** Production branch of the Cloudflare Pages project. */
  cloudflareBranch: string;
}
