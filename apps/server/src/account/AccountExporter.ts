import type { UserSettings } from '@metrack/domain';
import { ZipArchive } from './ZipArchive.js';
import type { AccountArchive } from './AccountArchive.js';
import type { AccountExport, ExportedImage } from './AccountExport.js';
import type { AccountExporterDeps } from './AccountExporterDeps.js';

const DATA_FILE = 'data.json';

/**
 * Builds the ZIP a user downloads to take their data with them: `data.json` with everything they have and
 * `images/` with the files of the images they own. Only that user's rows are read, so it must run with the
 * user bound in scope.
 */
export class AccountExporter {
  constructor(
    private readonly deps: AccountExporterDeps,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async build(userId: number): Promise<AccountArchive> {
    const { deps } = this;
    const user = await deps.users.get(userId);
    if (!user) throw new Error(`There is no user ${userId}`);
    const exportedAt = this.now();
    const zip = new ZipArchive(exportedAt);
    const images: ExportedImage[] = [];
    for (const image of await deps.images.ownedBy(userId)) {
      const present = await deps.images.hasFile(image);
      const file = present ? `images/${image.hash}.${image.extension}` : null;
      if (file !== null) zip.add(file, await deps.images.read(image));
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
    const data: AccountExport = {
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
    zip.add(DATA_FILE, Buffer.from(JSON.stringify(data, null, 2), 'utf8'), true);
    return { fileName: fileNameFor(userId, exportedAt), bytes: zip.toBuffer() };
  }
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
