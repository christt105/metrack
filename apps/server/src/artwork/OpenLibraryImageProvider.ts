import type { ImageCandidate, ImageKind, MediaType } from '@metrack/domain';
import type { OpenLibraryClient } from '../providers/openlibrary/OpenLibraryClient.js';
import { openLibraryCoverUrl } from '../providers/openlibrary/openLibraryCoverUrl.js';
import type { ImageProvider } from './ImageProvider.js';
import type { ImageSubject } from './ImageSubject.js';

const LANGUAGES: Record<string, string> = {
  spa: 'es',
  eng: 'en',
  fre: 'fr',
  ger: 'de',
  ita: 'it',
  por: 'pt',
  jpn: 'ja',
  dut: 'nl',
  kor: 'ko',
};

/** Offers the covers of a book's work and of its editions, those in the configured language first. */
export class OpenLibraryImageProvider implements ImageProvider {
  readonly name = 'openlibrary';

  constructor(private readonly client: OpenLibraryClient) {}

  supports(type: MediaType, kind: ImageKind): boolean {
    return type === 'book' && kind === 'cover';
  }

  async candidates(subject: ImageSubject): Promise<ImageCandidate[]> {
    if (subject.type !== 'book' || subject.entity.openLibraryId === null) return [];
    const workId = subject.entity.openLibraryId;
    const [record, editions] = await Promise.all([
      this.client.workRecord(workId),
      this.client.editions(workId),
    ]);
    const languages = new Map<number, string | null>();
    for (const edition of editions) {
      const language = languageOf(edition.languages?.[0]?.key);
      for (const id of edition.covers ?? []) {
        if (id > 0 && !languages.has(id)) languages.set(id, language);
      }
    }
    const own: number[] = [];
    const rest: number[] = [];
    for (const [id, language] of languages) {
      (language === this.client.language ? own : rest).push(id);
    }
    const fromWork = [...new Set(record.covers ?? [])].filter((id) => id > 0 && !own.includes(id));
    const ordered = [...own, ...fromWork, ...rest.filter((id) => !fromWork.includes(id))];
    return ordered.map((id) => ({
      provider: this.name,
      url: openLibraryCoverUrl(id, 'L') ?? '',
      thumbUrl: openLibraryCoverUrl(id, 'M') ?? '',
      width: null,
      height: null,
      score: null,
      language: languages.get(id) ?? null,
    }));
  }

  owns(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && parsed.hostname === 'covers.openlibrary.org';
    } catch {
      return false;
    }
  }
}

function languageOf(key: string | undefined): string | null {
  return LANGUAGES[key?.replace('/languages/', '') ?? ''] ?? null;
}
