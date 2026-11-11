import {
  canUseOwnArtwork,
  type Collection,
  type ImageCandidateList,
  type ImageKind,
  type MediaDetail,
  type User,
} from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import { imageRef, isImageHash } from '../images/imageRef.js';
import { ImageRejectedError } from '../images/ImageRejectedError.js';
import type { ImageStore } from '../images/ImageStore.js';
import type { MediaEditor } from '../media/MediaEditor.js';
import type { MediaEntity } from '../media/MediaEntity.js';
import type { SeriesRepository } from '../storage/repositories/SeriesRepository.js';
import type { ImageProvider } from './ImageProvider.js';
import type { ImageSubject } from './ImageSubject.js';

/** Lists artwork candidates from the providers and sets the one the user picks. */
export class ArtworkService {
  constructor(
    private readonly editor: MediaEditor,
    private readonly series: SeriesRepository,
    private readonly providers: readonly ImageProvider[],
    private readonly images: ImageStore,
  ) {}

  async candidates(
    collection: Collection,
    id: number,
    kind: ImageKind,
  ): Promise<ImageCandidateList> {
    const subject = await this.subject(collection, id);
    this.assertKind(collection, kind);
    const result: ImageCandidateList = { candidates: [], failures: [] };
    for (const provider of this.providers) {
      if (!provider.supports(subject.type, kind)) continue;
      try {
        result.candidates.push(...(await provider.candidates(subject, kind)));
      } catch (error) {
        result.failures.push({
          provider: provider.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return result;
  }

  /**
   * Points the entity at an image. A provider candidate is linked or copied as that provider requires;
   * owner and trusted users may also give a URL of any public site, copied as their own, or the reference
   * of an image they uploaded.
   */
  async choose(
    collection: Collection,
    id: number,
    kind: ImageKind,
    url: string,
    user: User,
  ): Promise<MediaDetail<MediaEntity>> {
    const subject = await this.subject(collection, id);
    this.assertKind(collection, kind);
    const fromProvider = this.providers.some((p) => p.supports(subject.type, kind) && p.owns(url));
    let ref: string;
    if (fromProvider) {
      ref = await this.fetching(() => this.images.reference(url, kind));
    } else if (!canUseOwnArtwork(user.role)) {
      throw new ApiError(
        403,
        'trusted_only',
        'Only trusted users can use covers and banners of their own',
      );
    } else if (url.startsWith(imageRef(''))) {
      const hash = url.slice(imageRef('').length);
      if (!isImageHash(hash) || !(await this.images.owns(hash, user.id))) {
        throw ApiError.badRequest('image_not_found', 'That image is not one of yours');
      }
      ref = url;
    } else {
      ref = await this.fetching(() =>
        this.images.copyOrLinkForUser(url, user.id, user.role === 'owner'),
      );
    }
    return this.editor.setImage(collection, id, kind, ref);
  }

  private async fetching(work: () => Promise<string>): Promise<string> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof ImageRejectedError) throw error;
      throw new ApiError(
        502,
        'image_download_failed',
        error instanceof Error ? error.message : 'Image download failed',
      );
    }
  }

  private assertKind(collection: Collection, kind: ImageKind): void {
    if (!this.editor.kind(collection).imageKinds.includes(kind)) {
      throw ApiError.badRequest('unsupported_image_kind', `${collection} have no ${kind}`);
    }
  }

  private async subject(collection: Collection, id: number): Promise<ImageSubject> {
    const entity = await this.editor.require(collection, id);
    const type = this.editor.kind(collection).type;
    if (type === 'season') {
      const season = entity as Extract<ImageSubject, { type: 'season' }>['entity'];
      const series = await this.series.get(season.seriesId);
      if (!series) throw ApiError.notFound();
      return { type, entity: season, series };
    }
    return { type, entity } as ImageSubject;
  }
}
