const VAULT_EMBED = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
const STORED_IMAGE = /!\[([^\]]*)\]\(\/api\/images\/[0-9a-f]{64}\)/g;

function vaultForm(body: string): string {
  return body.replace(
    VAULT_EMBED,
    (_, target: string) => `![${target.trim().split('/').at(-1)}]()`,
  );
}

function storedForm(review: string): string {
  return review.replace(STORED_IMAGE, (_, alt: string) => `![${alt}]()`);
}

/**
 * Whether a note body already says what the stored review says. The importer turned every
 * `![[file]]` embed into `![file](/api/images/...)`, so images are compared by file name.
 */
export function sameReview(body: string, review: string | null): boolean {
  return vaultForm(body).trim() === storedForm(review ?? '').trim();
}
