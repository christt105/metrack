import { ORPHAN_GRACE_MS, type ImageStore } from '../images/ImageStore.js';
import type { Logger } from '../notify/Logger.js';
import type { CloudImageCleanupResult } from './CloudImageCleanupResult.js';

/**
 * Deletes the orphan images (unused for more than the grace period, see `ImageStore.orphans`) of a store, or only
 * counts them. A run that would delete more than `maxCount` images or more than `maxFraction` of all of them
 * deletes nothing and throws, which caps the damage of a wrong orphan query. Each image goes through
 * `ImageStore.delete` (row, then file); one that fails is logged and the rest go on, and an object left behind
 * once its row is gone is harmless.
 */
export class CloudImageCleanup {
  constructor(
    private readonly store: ImageStore,
    private readonly maxFraction: number,
    private readonly maxCount: number,
    private readonly logger: Logger,
    private readonly now: () => number = () => Date.now(),
    private readonly graceMs: number = ORPHAN_GRACE_MS,
  ) {}

  async run(apply: boolean): Promise<CloudImageCleanupResult> {
    const started = this.now();
    const images = await this.store.list();
    const sizes = new Map(images.map((image) => [image.hash, image.byteSize]));
    const orphans = await this.store.orphans(this.graceMs);
    const result: CloudImageCleanupResult = {
      applied: apply,
      total: images.length,
      orphans: orphans.length,
      orphanBytes: orphans.reduce((sum, hash) => sum + (sizes.get(hash) ?? 0), 0),
      removed: 0,
      failed: 0,
      durationMs: 0,
    };
    if (apply) {
      this.refuseTooMany(result);
      for (const hash of orphans) {
        try {
          if (await this.store.delete(hash)) result.removed += 1;
        } catch (error) {
          result.failed += 1;
          this.logger.error(
            `cloud image cleanup: deleting ${hash} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    result.durationMs = this.now() - started;
    return result;
  }

  private refuseTooMany(result: CloudImageCleanupResult): void {
    if (result.orphans > this.maxCount) {
      throw new Error(
        `refusing to delete ${result.orphans} orphan images, more than the limit of ${this.maxCount}`,
      );
    }
    if (result.total > 0 && result.orphans / result.total > this.maxFraction) {
      throw new Error(
        `refusing to delete ${result.orphans} of ${result.total} images, more than ${Math.round(this.maxFraction * 100)}% of them`,
      );
    }
  }
}
