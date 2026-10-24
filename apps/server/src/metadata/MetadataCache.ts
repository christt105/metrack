import type { MediaType } from '@metrack/domain';
import type { ImageStore } from '../images/ImageStore.js';
import { defaultExpiryPolicy } from './defaultExpiryPolicy.js';
import type { ExpiryPolicy } from './ExpiryPolicy.js';
import { hashContent } from './hashContent.js';
import { isStale } from './isStale.js';
import type { MetadataStateRepository } from './MetadataStateRepository.js';
import type { MetadataTarget } from './MetadataTarget.js';
import type { RefreshResult } from './RefreshResult.js';

type Refresher = (id: number, force: boolean) => Promise<RefreshResult>;

/**
 * Keeps provider metadata fresh without asking for what has not expired and without
 * writing what has not changed. Fields marked as edited are never overwritten, and a
 * provider failure leaves the stored data untouched.
 */
export class MetadataCache {
  private readonly refreshers = new Map<MediaType, Refresher>();

  constructor(
    private readonly states: MetadataStateRepository,
    private readonly images: ImageStore,
    private readonly policy: ExpiryPolicy = defaultExpiryPolicy,
    private readonly now: () => Date = () => new Date(),
  ) {}

  register<T extends { id: number }>(type: MediaType, target: MetadataTarget<T>): void {
    this.refreshers.set(type, (id, force) => this.refreshOne(type, id, target, force));
  }

  supports(type: MediaType): boolean {
    return this.refreshers.has(type);
  }

  /** Refreshes when stale, or unconditionally with `force` (the manual refresh button). */
  async refresh(type: MediaType, id: number, force = false): Promise<RefreshResult> {
    const refresher = this.refreshers.get(type);
    if (!refresher) throw new Error(`No metadata source registered for ${type}`);
    return refresher(id, force);
  }

  private async refreshOne<T extends { id: number }>(
    type: MediaType,
    id: number,
    target: MetadataTarget<T>,
    force: boolean,
  ): Promise<RefreshResult> {
    const entity = target.repository.get(id);
    if (!entity) throw new Error(`${type} ${id} not found`);
    const state = this.states.get(type, id);
    if (!force && !isStale(state.fetchedAt, target.lifecycle(entity), this.policy, this.now())) {
      return { outcome: 'fresh' };
    }

    let provided;
    try {
      provided = await target.source.fetch(entity);
    } catch (error) {
      return { outcome: 'failed', error: error instanceof Error ? error.message : String(error) };
    }

    const fetchedAt = this.now().toISOString();
    const hash = hashContent(provided);
    if (hash === state.metadataHash) {
      this.states.markFetched(type, id, fetchedAt);
      return { outcome: 'unchanged' };
    }

    const patch: Record<string, unknown> = { ...provided.fields };
    let imageFailed = false;
    for (const [field, url] of [
      ['cover', provided.coverUrl],
      ['banner', provided.bannerUrl],
    ] as const) {
      if (url) {
        try {
          patch[field] = (await this.images.download(url)).ref;
        } catch {
          imageFailed = true;
          delete patch[field];
        }
      }
    }
    for (const field of state.editedFields) delete patch[field];

    const changed = Object.keys(patch).filter(
      (field) =>
        hashContent(patch[field]) !== hashContent((entity as Record<string, unknown>)[field]),
    );
    if (changed.length > 0) {
      target.repository.update(id, patch as Partial<Omit<T, 'id'>>);
    }
    this.states.markFetched(type, id, fetchedAt, imageFailed ? undefined : hash);
    return { outcome: 'updated', fields: changed };
  }
}
