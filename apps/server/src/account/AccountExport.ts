import type {
  ApiToken,
  Book,
  Movie,
  PublicPage,
  ReleaseAlert,
  Season,
  SeasonOverride,
  Series,
  UnlinkedTitle,
  UserSettings,
  Videogame,
} from '@metrack/domain';

/** One image a user owns, as listed in the export; `file` is its path inside the archive, or null when the bytes were missing. */
export interface ExportedImage {
  hash: string;
  ref: string;
  file: string | null;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  sourceUrl: string | null;
  createdAt: string;
}

/** Everything one user has in metrack, as written to `data.json` in their export. */
export interface AccountExport {
  format: 1;
  exportedAt: string;
  user: { id: number; name: string; email: string | null; role: string };
  /** The user's job settings without the ntfy topic, which acts as a password. */
  settings: Omit<UserSettings, 'ntfyTopic'> | null;
  publicPage: PublicPage;
  /** Name, access and dates only; the secrets are not stored in a form that can be given back. */
  tokens: ApiToken[];
  /** Each item merges the shared catalog row with the user's own entry and edits, as the app shows it. */
  movies: Movie[];
  series: Series[];
  seasons: Season[];
  videogames: Videogame[];
  books: Book[];
  seasonOverrides: SeasonOverride[];
  unlinkedTitles: UnlinkedTitle[];
  releaseAlerts: ReleaseAlert[];
  images: ExportedImage[];
}
