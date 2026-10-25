import type { ImageCandidate, ImageKind, MediaType } from '@metrack/domain';
import type { SteamGridDbClient } from '../providers/steamgriddb/SteamGridDbClient.js';
import type { ImageProvider } from './ImageProvider.js';
import type { ImageSubject } from './ImageSubject.js';

export class SteamGridDbImageProvider implements ImageProvider {
  readonly name = 'steamgriddb';

  constructor(private readonly client: SteamGridDbClient) {}

  supports(type: MediaType): boolean {
    return type === 'videogame';
  }

  async candidates(subject: ImageSubject, kind: ImageKind): Promise<ImageCandidate[]> {
    if (subject.type !== 'videogame' || subject.entity.steamGridDbId === null) return [];
    const images = await this.client.images(
      subject.entity.steamGridDbId,
      kind === 'cover' ? 'poster' : 'backdrop',
    );
    return images.map((image) => ({
      provider: this.name,
      url: image.url,
      thumbUrl: image.thumb,
      width: image.width,
      height: image.height,
      score: image.score,
      language: null,
    }));
  }

  owns(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol === 'https:' &&
        (parsed.hostname === 'steamgriddb.com' || parsed.hostname.endsWith('.steamgriddb.com'))
      );
    } catch {
      return false;
    }
  }
}
