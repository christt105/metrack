import { parseImageSource } from './parseImageSource.js';
import type { ImageSource } from './ImageSource.js';
import type { IssueLog } from './IssueLog.js';
import type { VaultNote } from './VaultNote.js';

export interface ArtworkSources {
  cover: ImageSource | null;
  banner: ImageSource | null;
}

export function readArtwork(note: VaultNote, vaultDir: string, issues: IssueLog): ArtworkSources {
  return {
    cover: parseImageSource(note.frontmatter.cover, 'cover', vaultDir, note.path, issues),
    banner: parseImageSource(note.frontmatter.banner, 'banner', vaultDir, note.path, issues),
  };
}
