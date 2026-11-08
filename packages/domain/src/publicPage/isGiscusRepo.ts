const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** Whether a value looks like a GitHub repository name, `owner/name`. */
export function isGiscusRepo(value: string): boolean {
  return REPO_PATTERN.test(value);
}
