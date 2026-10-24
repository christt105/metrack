import { collectImageSources } from './collectImageSources.js';
import type { ImportPlan } from './ImportPlan.js';
import type { LegacyImageIndex } from './LegacyImageIndex.js';
import type { RemoteImageSummary } from './RemoteImageSummary.js';

/** Splits the distinct remote URLs of the plan into those with a local copy and those without. */
export function summarizeRemoteImages(
  plan: ImportPlan,
  index: LegacyImageIndex | null,
): RemoteImageSummary {
  const urls = new Set(
    collectImageSources(plan).flatMap((image) => (image.kind === 'remote' ? [image.url] : [])),
  );
  const unresolved = [...urls].filter((url) => index?.find(url) == null);
  return { total: urls.size, resolved: urls.size - unresolved.length, unresolved };
}
