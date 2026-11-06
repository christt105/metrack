import {
  addRewatch,
  transitionStatus,
  type Collection,
  type ImageKind,
  type MediaDetail,
  type Tracking,
} from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import { imageRef } from '../images/imageRef.js';
import type { ImageStore } from '../images/ImageStore.js';
import type { MetadataStateRepository } from '../storage/repositories/MetadataStateRepository.js';
import { fieldsOf } from './fieldsOf.js';
import { isIsoDate } from './isIsoDate.js';
import type { MediaEntity } from './MediaEntity.js';
import type { MediaKind } from './MediaKind.js';

const DATE_FIELDS = ['startedAt', 'finishedAt', 'releaseDate', 'firstAirDate'];

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Reads and edits entities of every collection. Edits to descriptive metadata are recorded as
 * hand-edited so a later provider refresh does not overwrite them.
 */
export class MediaEditor {
  constructor(
    private readonly kinds: Record<Collection, MediaKind>,
    private readonly states: MetadataStateRepository,
    private readonly images: ImageStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  kind(collection: Collection): MediaKind {
    return this.kinds[collection];
  }

  async require(collection: Collection, id: number): Promise<MediaEntity> {
    const entity = await this.kinds[collection].repository.get(id);
    if (!entity) throw ApiError.notFound();
    return entity;
  }

  async detail(collection: Collection, id: number): Promise<MediaDetail<MediaEntity>> {
    return this.describe(collection, await this.require(collection, id));
  }

  async create(
    collection: Collection,
    input: Record<string, unknown>,
  ): Promise<MediaDetail<MediaEntity>> {
    const kind = this.kinds[collection];
    const values = { ...kind.defaults(), ...input };
    this.validate(values);
    await kind.checkReferences?.(values);
    const created = await kind.repository.create(values);
    return this.describe(collection, created);
  }

  async patch(
    collection: Collection,
    id: number,
    patch: Record<string, unknown>,
  ): Promise<MediaDetail<MediaEntity>> {
    const kind = this.kinds[collection];
    const current = fieldsOf(await this.require(collection, id));
    const { status, ...rest } = patch;
    let working: Record<string, unknown> = { ...current };

    if (typeof status === 'string' && status !== current.status) {
      try {
        working = {
          ...working,
          ...transitionStatus(
            working as unknown as Tracking,
            status as Tracking['status'],
            this.today(),
          ),
        };
      } catch (error) {
        throw ApiError.conflict(
          'invalid_transition',
          error instanceof Error ? error.message : 'Invalid status transition',
        );
      }
    }
    for (const [field, value] of Object.entries(rest)) {
      working[field] = field === 'rewatches' ? [...new Set(value as string[])].sort() : value;
    }
    if ('finishedAt' in rest && !('startedAt' in rest) && current.startedAt === null) {
      working.startedAt = null;
    }
    this.validate(working);
    if ('startedAt' in rest || 'finishedAt' in rest || status !== undefined) {
      this.validateOrder(working);
    }

    const changes: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(working)) {
      if (!same(value, current[field])) changes[field] = value;
    }
    if (Object.keys(changes).length === 0)
      return this.describe(collection, await this.require(collection, id));

    const edits: Record<string, unknown> = {};
    const others: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(changes)) {
      if (kind.metadataFields.includes(field) && field in rest) edits[field] = value;
      else others[field] = value;
    }
    let updated = await kind.repository.update(id, others);
    if (Object.keys(edits).length > 0) updated = await kind.repository.override(id, edits);
    return this.describe(collection, updated);
  }

  async remove(collection: Collection, id: number): Promise<void> {
    if (!(await this.kinds[collection].repository.delete(id))) throw ApiError.notFound();
  }

  async addRewatch(
    collection: Collection,
    id: number,
    date: string,
  ): Promise<MediaDetail<MediaEntity>> {
    const kind = this.trackable(collection);
    if (!isIsoDate(date)) throw ApiError.badRequest('invalid_date', `Not a valid date: ${date}`);
    const current = fieldsOf(await this.require(collection, id)) as unknown as Tracking;
    let next: Tracking;
    try {
      next = addRewatch(current, date);
    } catch (error) {
      throw ApiError.conflict(
        'invalid_rewatch',
        error instanceof Error ? error.message : 'Cannot rewatch',
      );
    }
    return this.describe(
      collection,
      await kind.repository.update(id, { rewatches: next.rewatches }),
    );
  }

  async removeRewatch(
    collection: Collection,
    id: number,
    date: string,
  ): Promise<MediaDetail<MediaEntity>> {
    const kind = this.trackable(collection);
    const current = fieldsOf(await this.require(collection, id)) as unknown as Tracking;
    if (!current.rewatches.includes(date)) throw ApiError.notFound('No rewatch on that date');
    const rewatches = current.rewatches.filter((d) => d !== date);
    return this.describe(collection, await kind.repository.update(id, { rewatches }));
  }

  /** Lets a provider refresh overwrite the field again. */
  async unmarkEdited(
    collection: Collection,
    id: number,
    field: string,
  ): Promise<MediaDetail<MediaEntity>> {
    const kind = this.kinds[collection];
    await this.require(collection, id);
    if (!(await kind.repository.overriddenFields(id)).includes(field)) {
      throw ApiError.notFound('That field is not marked as edited');
    }
    await kind.repository.clearOverride(id, field);
    return this.detail(collection, id);
  }

  /** Points a cover or banner at a stored image and protects it from refreshes. */
  async setImage(
    collection: Collection,
    id: number,
    image: ImageKind,
    ref: string,
  ): Promise<MediaDetail<MediaEntity>> {
    const kind = this.imageKind(collection, image);
    await this.require(collection, id);
    const updated = await kind.repository.override(id, { [image]: ref });
    return this.describe(collection, updated);
  }

  /** Clears a cover or banner and removes the stored file when nothing else uses it. */
  async clearImage(
    collection: Collection,
    id: number,
    image: ImageKind,
  ): Promise<MediaDetail<MediaEntity>> {
    const kind = this.imageKind(collection, image);
    const ref = fieldsOf(await this.require(collection, id))[image];
    const updated = await kind.repository.override(id, { [image]: null });
    if (typeof ref === 'string') {
      const hash = ref.slice(imageRef('').length);
      if ((await this.images.orphans()).includes(hash)) await this.images.delete(hash);
    }
    return this.describe(collection, updated);
  }

  async describe(collection: Collection, entity: MediaEntity): Promise<MediaDetail<MediaEntity>> {
    const kind = this.kinds[collection];
    const state = await this.states.get(kind.type, entity.id);
    return {
      ...entity,
      ...((await kind.extend?.(entity)) ?? {}),
      editedFields: state.editedFields,
      fetchedAt: state.fetchedAt,
    };
  }

  private trackable(collection: Collection): MediaKind {
    const kind = this.kinds[collection];
    if (!kind.trackable)
      throw ApiError.badRequest('not_trackable', `${collection} have no tracking`);
    return kind;
  }

  private imageKind(collection: Collection, image: ImageKind): MediaKind {
    const kind = this.kinds[collection];
    if (!kind.imageKinds.includes(image)) {
      throw ApiError.badRequest('unsupported_image_kind', `${collection} have no ${image}`);
    }
    return kind;
  }

  private today(): string {
    return this.now().toISOString().slice(0, 10);
  }

  private validate(values: Record<string, unknown>): void {
    for (const field of DATE_FIELDS) {
      const value = values[field];
      if (typeof value === 'string' && !isIsoDate(value)) {
        throw ApiError.badRequest('invalid_date', `${field} is not a valid date: ${value}`);
      }
    }
    const rewatches = values.rewatches;
    if (Array.isArray(rewatches)) {
      for (const date of rewatches) {
        if (typeof date !== 'string' || !isIsoDate(date)) {
          throw ApiError.badRequest(
            'invalid_date',
            `rewatches has an invalid date: ${String(date)}`,
          );
        }
      }
    }
  }

  private validateOrder(values: Record<string, unknown>): void {
    const { startedAt, finishedAt } = values;
    if (typeof startedAt === 'string' && typeof finishedAt === 'string' && finishedAt < startedAt) {
      throw ApiError.badRequest('invalid_dates', 'finishedAt cannot be before startedAt');
    }
  }
}
