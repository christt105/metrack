/** What every user's site is built and uploaded with. Each user sets their own project and address. */
export interface PublishConfig {
  /** A Hugo project (config, layouts, assets, data, static pages) without the exported content sections. */
  siteTemplateDir: string;
  hugoBinary: string;
  wranglerBinary: string;
  cloudflareApiToken: string;
  cloudflareAccountId: string;
  /** Production branch of the Cloudflare Pages projects. */
  cloudflareBranch: string;
}
