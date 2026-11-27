import type {
  Collection,
  ImageCandidateList,
  ImageKind,
  ImageUsage,
  UploadedImage,
} from '@metrack/domain';
import type { Detail } from '../Detail';
import type { HttpTransport } from '../HttpTransport';
import type { ImageSettings } from '../ImageSettings';
import { DEFAULT_RECODE_MAX_SIDE } from '../../logic/recodeToWebp';

export class ImagesApi {
  private settings: Promise<ImageSettings> | undefined;

  constructor(
    private readonly transport: HttpTransport,
    private readonly recode: (file: Blob, maxSide: number) => Promise<Blob>,
  ) {}

  imageCandidates(
    collection: Collection,
    id: number,
    kind: ImageKind,
  ): Promise<ImageCandidateList> {
    return this.transport.request('GET', `/${collection}/${id}/images/${kind}`);
  }

  chooseImage<C extends Collection>(
    collection: C,
    id: number,
    kind: ImageKind,
    url: string,
  ): Promise<Detail<C>> {
    return this.transport.request('PUT', `/${collection}/${id}/images/${kind}`, { url });
  }

  clearImage<C extends Collection>(collection: C, id: number, kind: ImageKind): Promise<Detail<C>> {
    return this.transport.request('DELETE', `/${collection}/${id}/images/${kind}`);
  }

  /**
   * Uploads an image file and counts it for the user's quota. The server stores it as WebP; when it reports
   * that images are encoded by the client, the file is recoded to WebP in the browser first.
   */
  async uploadImage(file: Blob): Promise<UploadedImage> {
    const { imageEncoding, maxDimension } = await this.imageSettings();
    const body = imageEncoding === 'client' ? await this.recode(file, maxDimension) : file;
    return this.transport.request('POST', '/images', body);
  }

  private async imageSettings(): Promise<ImageSettings> {
    this.settings ??= this.imageUsage().then(({ imageEncoding, maxDimension }) => ({
      imageEncoding,
      maxDimension,
    }));
    try {
      return await this.settings;
    } catch {
      this.settings = undefined;
      return { imageEncoding: 'server', maxDimension: DEFAULT_RECODE_MAX_SIDE };
    }
  }

  imageUsage(): Promise<ImageUsage> {
    return this.transport.request('GET', '/images/usage');
  }

  cleanupImages(): Promise<{ removed: string[] }> {
    return this.transport.request('POST', '/images/cleanup');
  }

  async imageBytes(hash: string): Promise<Uint8Array> {
    const response = await this.transport.send('GET', `/images/${hash}`);
    return new Uint8Array(await response.arrayBuffer());
  }
}
