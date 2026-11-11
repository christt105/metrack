import type { UserSettings } from '@metrack/domain';
import type { StoredImage } from '../images/StoredImage.js';
import { ZipArchive } from './ZipArchive.js';
import type { AccountArchive } from './AccountArchive.js';
import type { AccountExport, ExportedImage } from './AccountExport.js';
import type { AccountExporterDeps } from './AccountExporterDeps.js';

const DATA_FILE = 'data.json';

/**
 * Collects what a user takes with them: `data.json` with everything they have and the list of the images they
 * own, and the ZIP that packs both with the image files under `images/`. Only that user's rows are read, so
 * it must run with the user bound in scope. With `checkFiles` off an image counts as present without asking
 * the store, which saves one lookup per image; the client then drops the entries whose bytes it cannot fetch.
 */
export class AccountExporter {
  constructor(
    private readonly deps: AccountExporterDeps,
    private readonly now: () => Date = () => new Date(),
    private readonly checkFiles = true,
  ) {}

  async build(userId: number): Promise<AccountArchive> {
    const exportedAt = this.now();
    const data = await this.data(userId, exportedAt);
    const zip = new ZipArchive(exportedAt);
    const present = new Set(data.images.filter((entry) => entry.file !== null).map((e) => e.hash));
    for (const image of await this.deps.images.ownedBy(userId)) {
      if (present.has(image.hash)) {
        zip.add(archivePath(image), await this.deps.images.read(image));
      }
    }
    zip.add(DATA_FILE, Buffer.from(JSON.stringify(data, null, 2), 'utf8'), true);
    return { fileName: fileNameFor(userId, exportedAt), bytes: zip.toBuffer() };
  }

  async data(userId: number, exportedAt: Date = this.now()): Promise<AccountExport> {
    const { deps } = this;
    const user = await deps.users.get(userId);
    if (!user) throw new Error(`There is no user ${userId}`);
    const images: ExportedImage[] = [];
    for (const image of await deps.images.ownedBy(userId)) {
      const present = !this.checkFiles || (await deps.images.hasFile(image));
      const file = present ? archivePath(image) : null;
      images.push({
        hash: image.hash,
        ref: image.ref,
        file,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        byteSize: image.byteSize,
        sourceUrl: image.sourceUrl,
        createdAt: image.createdAt,
      });
    }
    const series = await deps.series.list();
    const seasonOverrides = (
      await Promise.all(series.map((entry) => deps.overrides.listBySeries(entry.id)))
    ).flat();
    const settings = await deps.settings.get(userId);
    return {
      format: 1,
      exportedAt: exportedAt.toISOString(),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      settings: settings ? withoutTopic(settings) : null,
      publicPage: await deps.profiles.get(userId),
      tokens: await deps.apiTokens.listForUser(userId),
      movies: await deps.movies.list(),
      series,
      seasons: await deps.seasons.list(),
      videogames: await deps.videogames.list(),
      books: await deps.books.list(),
      seasonOverrides,
      unlinkedTitles: await deps.unlinked.list(),
      releaseAlerts: await deps.releaseAlerts.list(),
      images,
    };
  }
}

function archivePath(image: StoredImage): string {
  return `images/${image.hash}.${image.extension}`;
}

function withoutTopic(settings: UserSettings): Omit<UserSettings, 'ntfyTopic'> {
  return {
    jellyfinUser: settings.jellyfinUser,
    publishProject: settings.publishProject,
    publishBaseUrl: settings.publishBaseUrl,
    mirrorDir: settings.mirrorDir,
    mirrorLinkPrefix: settings.mirrorLinkPrefix,
  };
}

function fileNameFor(userId: number, at: Date): string {
  return `metrack-export-user-${userId}-${at.toISOString().slice(0, 10)}.zip`;
}
