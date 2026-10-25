import type { Collection, ImageCandidateList, ImageKind, MediaDetail } from '@metrack/domain';
import { ApiError } from '../api/ApiError.js';
import type { ImageStore } from '../images/ImageStore.js';
import type { MediaEditor } from '../media/MediaEditor.js';
import type { MediaEntity } from '../media/MediaEntity.js';
import type { SeriesRepository } from '../storage/repositories/SeriesRepository.js';
import type { ImageProvider } from './ImageProvider.js';
import type { ImageSubject } from './ImageSubject.js';

/** Lists artwork candidates from the providers and stores the one the user picks. */
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
    const subject = this.subject(collection, id);
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

  /** Downloads the image into the store and points the entity at the stored copy. */
  async choose(
    collection: Collection,
    id: number,
    kind: ImageKind,
    url: string,
  ): Promise<MediaDetail<MediaEntity>> {
    const subject = this.subject(collection, id);
    this.assertKind(collection, kind);
    if (!this.providers.some((p) => p.supports(subject.type, kind) && p.owns(url))) {
      throw ApiError.badRequest(
        'url_not_allowed',
        'That image does not come from a known provider',
      );
    }
    let ref: string;
    try {
      ref = (await this.images.download(url)).ref;
    } catch (error) {
      throw new ApiError(
        502,
        'image_download_failed',
        error instanceof Error ? error.message : 'Image download failed',
      );
    }
    return this.editor.setImage(collection, id, kind, ref);
  }

  private assertKind(collection: Collection, kind: ImageKind): void {
    if (!this.editor.kind(collection).imageKinds.includes(kind)) {
      throw ApiError.badRequest('unsupported_image_kind', `${collection} have no ${kind}`);
    }
  }

  private subject(collection: Collection, id: number): ImageSubject {
    const entity = this.editor.require(collection, id);
    const type = this.editor.kind(collection).type;
    if (type === 'season') {
      const season = entity as Extract<ImageSubject, { type: 'season' }>['entity'];
      const series = this.series.get(season.seriesId);
      if (!series) throw ApiError.notFound();
      return { type, entity: season, series };
    }
    return { type, entity } as ImageSubject;
  }
}
