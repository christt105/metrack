/** Where the giscus comments of a public page live: a GitHub repository with Discussions and one of its categories. */
export interface GiscusConfig {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
}
