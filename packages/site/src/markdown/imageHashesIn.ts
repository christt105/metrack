const EMBEDDED_IMAGE = /!\[[^\]]*\]\(\/api\/images\/([0-9a-f]{64})\)/g;

/** The hashes of the stored images a review embeds. */
export function imageHashesIn(review: string): string[] {
  return [...review.matchAll(EMBEDDED_IMAGE)].map((match) => match[1] as string);
}
